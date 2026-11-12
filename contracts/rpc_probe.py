# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# Diagnostic only: POST a given body to a given URL, store the status and the first bytes of the answer.
import json

from genlayer import *


class RpcProbe(gl.Contract):
    answer: str

    def __init__(self):
        self.answer = ""

    @gl.public.write
    def send(self, url: str, body: str) -> None:
        def f():
            r = gl.nondet.web.post(url, body=body.encode("utf-8"), headers={"Content-Type": "application/json"})
            st = getattr(r, "status_code", None)
            if st is None:
                st = getattr(r, "status", None)
            txt = r.body.decode("utf-8", errors="replace") if r.body else ""
            return json.dumps({"status": int(st), "len": len(txt), "head": txt[:160]}, sort_keys=True)

        self.answer = gl.eq_principle.strict_eq(f)

    @gl.public.view
    def get(self) -> str:
        return self.answer
