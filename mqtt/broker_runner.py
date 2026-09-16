"""
AQUA-NEXUS MQTT Broker Runner
Runs Mosquitto if installed, or falls back to an embedded asyncio MQTT 3.1.1 broker.
Zero-dependency fallback ensures 100% portability on any development machine.
"""

import asyncio
import logging
import os
import shutil
import struct
import subprocess
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [MQTT-Broker] %(message)s"
)
logger = logging.getLogger("AQUA-NEXUS-BROKER")


def topic_matches(sub_filter: str, topic: str) -> bool:
    """Matches an MQTT topic against a subscription filter (+ and # wildcards)."""
    if sub_filter == "#" or sub_filter == topic:
        return True
    
    sub_parts = sub_filter.split("/")
    top_parts = topic.split("/")
    
    for i, part in enumerate(sub_parts):
        if part == "#":
            return True
        if i >= len(top_parts):
            return False
        if part != "+" and part != top_parts[i]:
            return False
            
    return len(sub_parts) == len(top_parts)


class EmbeddedMQTTBroker:
    """
    Lightweight, high-performance pure-Python MQTT 3.1.1 Broker.
    Supports QoS 0/1, wildcards (+, #), retained messages, and keepalive pings.
    """
    def __init__(self, host: str = "0.0.0.0", port: int = 1883):
        self.host = host
        self.port = port
        self.clients = set()
        # client -> set of (topic_filter, qos)
        self.subscriptions = {}
        # topic -> (payload, qos)
        self.retained_messages = {}
        self.server = None

    def decode_remaining_length(self, data: bytes, offset: int = 1):
        multiplier = 1
        value = 0
        idx = offset
        while True:
            if idx >= len(data):
                return None, idx
            encoded_byte = data[idx]
            value += (encoded_byte & 127) * multiplier
            multiplier *= 128
            idx += 1
            if (encoded_byte & 128) == 0:
                break
        return value, idx

    def encode_remaining_length(self, length: int) -> bytes:
        encoded = bytearray()
        while True:
            digit = length % 128
            length = length // 128
            if length > 0:
                digit = digit | 128
            encoded.append(digit)
            if length == 0:
                break
        return bytes(encoded)

    async def handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        client_addr = writer.get_extra_info("peername")
        client_id = f"client-{id(writer)}"
        logger.info(f"Incoming connection from {client_addr}")
        self.clients.add(writer)
        self.subscriptions[writer] = set()

        try:
            while True:
                header = await reader.read(1)
                if not header:
                    break
                packet_type = header[0] >> 4
                flags = header[0] & 0x0F

                # Read variable length
                multiplier = 1
                rem_len = 0
                while True:
                    b = await reader.read(1)
                    if not b:
                        return
                    rem_len += (b[0] & 127) * multiplier
                    multiplier *= 128
                    if (b[0] & 128) == 0:
                        break

                body = await reader.readexactly(rem_len) if rem_len > 0 else b""

                if packet_type == 1:  # CONNECT
                    # Protocol name & version, flags, keepalive, client id
                    proto_len = struct.unpack("!H", body[0:2])[0]
                    idx = 2 + proto_len + 1 + 1 + 2
                    if idx < len(body):
                        cid_len = struct.unpack("!H", body[idx:idx+2])[0]
                        client_id = body[idx+2:idx+2+cid_len].decode("utf-8", errors="ignore")
                    logger.info(f"Client connected: id='{client_id}' from {client_addr}")
                    # CONNACK: Fixed header 0x20, len 2, session present 0, code 0 (accepted)
                    connack = bytes([0x20, 0x02, 0x00, 0x00])
                    writer.write(connack)
                    await writer.drain()

                elif packet_type == 3:  # PUBLISH
                    dup = (flags & 0x08) != 0
                    qos = (flags & 0x06) >> 1
                    retain = (flags & 0x01) != 0

                    topic_len = struct.unpack("!H", body[0:2])[0]
                    topic = body[2:2+topic_len].decode("utf-8", errors="ignore")
                    payload_start = 2 + topic_len
                    packet_id = None
                    if qos > 0:
                        packet_id = struct.unpack("!H", body[payload_start:payload_start+2])[0]
                        payload_start += 2
                    payload = body[payload_start:]

                    # PUBACK if QoS 1
                    if qos == 1 and packet_id is not None:
                        puback = bytes([0x40, 0x02]) + struct.pack("!H", packet_id)
                        writer.write(puback)
                        await writer.drain()

                    if retain:
                        if payload:
                            self.retained_messages[topic] = (payload, qos)
                        elif topic in self.retained_messages:
                            del self.retained_messages[topic]

                    # Distribute to subscribers
                    await self.broadcast(topic, payload, qos=0)

                elif packet_type == 8:  # SUBSCRIBE
                    packet_id = struct.unpack("!H", body[0:2])[0]
                    idx = 2
                    return_codes = []
                    while idx < len(body):
                        t_len = struct.unpack("!H", body[idx:idx+2])[0]
                        idx += 2
                        sub_topic = body[idx:idx+t_len].decode("utf-8", errors="ignore")
                        idx += t_len
                        sub_qos = body[idx]
                        idx += 1
                        self.subscriptions[writer].add((sub_topic, sub_qos))
                        return_codes.append(min(sub_qos, 1))
                        logger.debug(f"Client {client_id} subscribed to '{sub_topic}'")

                        # Send matching retained messages
                        for r_topic, (r_payload, r_qos) in self.retained_messages.items():
                            if topic_matches(sub_topic, r_topic):
                                await self.send_publish(writer, r_topic, r_payload, qos=0)

                    # SUBACK
                    suback_body = struct.pack("!H", packet_id) + bytes(return_codes)
                    suback = bytes([0x90]) + self.encode_remaining_length(len(suback_body)) + suback_body
                    writer.write(suback)
                    await writer.drain()

                elif packet_type == 10:  # UNSUBSCRIBE
                    packet_id = struct.unpack("!H", body[0:2])[0]
                    idx = 2
                    while idx < len(body):
                        t_len = struct.unpack("!H", body[idx:idx+2])[0]
                        idx += 2
                        unsub_topic = body[idx:idx+t_len].decode("utf-8", errors="ignore")
                        idx += t_len
                        self.subscriptions[writer] = {
                            (s_top, s_qos) for s_top, s_qos in self.subscriptions[writer]
                            if s_top != unsub_topic
                        }
                    unsuback = bytes([0xB0, 0x02]) + struct.pack("!H", packet_id)
                    writer.write(unsuback)
                    await writer.drain()

                elif packet_type == 12:  # PINGREQ
                    # PINGRESP
                    writer.write(bytes([0xD0, 0x00]))
                    await writer.drain()

                elif packet_type == 14:  # DISCONNECT
                    break

        except (asyncio.IncompleteReadError, ConnectionResetError, BrokenPipeError):
            pass
        except Exception as e:
            logger.warning(f"Error handling client {client_id}: {e}")
        finally:
            logger.info(f"Client disconnected: id='{client_id}'")
            self.clients.discard(writer)
            self.subscriptions.pop(writer, None)
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    async def send_publish(self, writer: asyncio.StreamWriter, topic: str, payload: bytes, qos: int = 0):
        try:
            topic_bytes = topic.encode("utf-8")
            var_header = struct.pack("!H", len(topic_bytes)) + topic_bytes
            body = var_header + payload
            rem_len = self.encode_remaining_length(len(body))
            packet = bytes([0x30]) + rem_len + body
            writer.write(packet)
            await writer.drain()
        except Exception as e:
            logger.debug(f"Failed to publish to client: {e}")

    async def broadcast(self, topic: str, payload: bytes, qos: int = 0):
        for client, sub_list in list(self.subscriptions.items()):
            for sub_filter, sub_qos in sub_list:
                if topic_matches(sub_filter, topic):
                    asyncio.create_task(self.send_publish(client, topic, payload, qos=0))
                    break

    async def start(self):
        self.server = await asyncio.start_server(self.handle_client, self.host, self.port)
        addrs = ", ".join(str(sock.getsockname()) for sock in self.server.sockets)
        logger.info(f"Embedded MQTT Broker listening on {addrs} (MQTT v3.1.1 standard)")
        async with self.server:
            await self.server.serve_forever()


def run_broker():
    # If mosquitto is installed and --force-embedded is not given, we can try mosquitto
    mosquitto_path = shutil.which("mosquitto")
    if mosquitto_path and "--embedded" not in sys.argv:
        conf_path = os.path.join(os.path.dirname(__file__), "mosquitto.conf")
        cmd = [mosquitto_path, "-c", conf_path, "-v"]
        logger.info(f"Starting Mosquitto broker: {' '.join(cmd)}")
        try:
            subprocess.run(cmd)
            return
        except KeyboardInterrupt:
            logger.info("Mosquitto stopped.")
            return
        except Exception as e:
            logger.warning(f"Failed to run mosquitto: {e}. Falling back to embedded broker.")

    # Fallback / Default: Embedded pure-Python MQTT Broker
    logger.info("Launching AQUA-NEXUS Embedded Python MQTT Broker...")
    try:
        asyncio.run(EmbeddedMQTTBroker().start())
    except KeyboardInterrupt:
        logger.info("Embedded broker stopped.")


if __name__ == "__main__":
    run_broker()
