import json, sys, struct, pathlib
def pad(b, fill=b" ", align=4): return b + (b" " * ((align - len(b)%align)%align))
inp, out = sys.argv[1], sys.argv[2]
base = pathlib.Path(inp).parent
gltf = json.loads(pathlib.Path(inp).read_text())
buffers = gltf.get("buffers")
if isinstance(buffers, dict):
    # glTF 1.0 exports sometimes use object keys instead of an array
    first_key = next(iter(buffers))
    buf_entry = buffers[first_key]
    buf_uri = buf_entry.get("uri")
elif isinstance(buffers, list):
    buf_entry = buffers[0]
    buf_uri = buf_entry.get("uri")
else:
    raise RuntimeError("Unsupported buffers structure")
if not buf_uri:
    raise RuntimeError("No external buffer uri found on the first buffer")
bin_data = pathlib.Path(base, buf_uri).read_bytes()
buf_entry["uri"] = None
buf_entry["byteLength"] = len(bin_data)
json_chunk = pad(json.dumps(gltf, separators=(",", ":")).encode("utf-8"))
bin_chunk = pad(bin_data, b"\0")
glb = [
    b"glTF", struct.pack("<I", 2),
    struct.pack("<I", 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)),
    struct.pack("<I", len(json_chunk)), b"JSON", json_chunk,
    struct.pack("<I", len(bin_chunk)), b"BIN\0", bin_chunk
]
pathlib.Path(out).write_bytes(b"".join(glb))
print(f"Packed {inp} -> {out}, {len(b''.join(glb))} bytes")
