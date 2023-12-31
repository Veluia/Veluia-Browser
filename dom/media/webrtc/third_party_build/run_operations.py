# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
import os
import subprocess
import sys

# This is a collection of helper functions that use the subprocess.run
# command to execute commands.  In the future, if we have cases where
# we find common python functionality in utilizing the data returned
# from these functions, that functionality can live here for easy reuse
# between other python scripts in dom/media/webrtc/third_party_build.


# must run 'hg' with HGPLAIN=1 to ensure aliases don't interfere with
# command output.
env = os.environ.copy()
env["HGPLAIN"] = "1"


def run_hg(cmd):
    cmd_list = cmd.split(" ")
    res = subprocess.run(
        cmd_list,
        capture_output=True,
        text=True,
        env=env,
    )
    if res.returncode != 0:
        print(
            "Hit return code {} running '{}'. Aborting.".format(res.returncode, cmd),
            file=sys.stderr,
        )
        print(res.stderr)
        sys.exit(1)
    stdout = res.stdout.strip()
    return [] if len(stdout) == 0 else stdout.split("\n")


def run_git(cmd, working_dir):
    cmd_list = cmd.split(" ")
    res = subprocess.run(
        cmd_list,
        capture_output=True,
        text=True,
        cwd=working_dir,
    )
    if res.returncode != 0:
        print(
            "Hit return code {} running '{}'. Aborting.".format(res.returncode, cmd),
            file=sys.stderr,
        )
        print(res.stderr)
        sys.exit(1)
    stdout = res.stdout.strip()
    return [] if len(stdout) == 0 else stdout.split("\n")


def run_shell(cmd, capture_output=True):
    res = subprocess.run(
        cmd,
        shell=True,
        capture_output=capture_output,
        text=True,
    )
    if res.returncode != 0:
        print(
            "Hit return code {} running '{}'. Aborting.".format(res.returncode, cmd),
            file=sys.stderr,
        )
        print(res.stderr)
        sys.exit(1)
    output_lines = []
    if capture_output:
        stdout = res.stdout.strip()
        output_lines = [] if len(stdout) == 0 else stdout.split("\n")

    return output_lines
