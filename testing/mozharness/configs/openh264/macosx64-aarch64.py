# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os

import mozharness

external_tools_path = os.path.join(
    os.path.abspath(os.path.dirname(os.path.dirname(mozharness.__file__))),
    "external_tools",
)

config = {
    "exes": {
        "gittool.py": [os.path.join(external_tools_path, "gittool.py")],
        "python3": "python3",
    },
    "dump_syms_binary": "{}/dump_syms/dump_syms".format(os.environ["MOZ_FETCHES_DIR"]),
    "arch": "aarch64",
    "operating_system": "darwin",
    "partial_env": {
        "CFLAGS": (
            "-target aarch64-apple-darwin -mcpu=apple-a12 "
            "-isysroot {MOZ_FETCHES_DIR}/MacOSX13.0.sdk "
            "-mmacosx-version-min=11.0".format(
                MOZ_FETCHES_DIR=os.environ["MOZ_FETCHES_DIR"]
            )
        ),
        "LDFLAGS": (
            "-target aarch64-apple-darwin -mcpu=apple-a12 "
            "-isysroot {MOZ_FETCHES_DIR}/MacOSX13.0.sdk "
            "-mmacosx-version-min=11.0".format(
                MOZ_FETCHES_DIR=os.environ["MOZ_FETCHES_DIR"]
            )
        ),
        "PATH": (
            "{MOZ_FETCHES_DIR}/clang/bin/:{MOZ_FETCHES_DIR}/cctools/bin/:%(PATH)s".format(
                MOZ_FETCHES_DIR=os.environ["MOZ_FETCHES_DIR"]
            )
        ),
    },
}
