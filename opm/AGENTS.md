# OPM agent rules

OPM features are **private by default**. The owner uses them locally (`./opm.sh`, `./opm-super.sh`, `./opm.sh install-app`, `./opm.sh pack`). Sharing to GitHub or other people is opt-in.

## Do not share unless asked

Do not `git push`, open/update PRs, post issue/PR comments, or `npm publish` for OPM unless the user explicitly allows it (e.g. "chia sẻ pack memory", "push", "mở PR"). `.husky/pre-push` blocks `git push` unless `PI_ALLOW_GITHUB_SHARE=1`.

Local `git commit` is OK when they ask to commit, or when they asked for the change and want it saved on disk. Push is the share step.

## Local use (not sharing)

```bash
./opm.sh install-app
super-pi --help
super-pi
```

`./opm.sh pack --out /tmp/super-pi` then `bash /tmp/super-pi/install.sh` is the same install from a snapshot. Do not `./opm.sh attach` (writes host `omp`/`pi` settings). Do not install a wrapper named `pi` or `omp`.

## When they allow sharing

Share only what they named (one pack, one commit, one branch). Do not include unrelated private packs. Ask which remote (`origin` public fork vs a private repo) if unclear.
