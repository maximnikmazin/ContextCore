#!/bin/bash
# Optional off-site backup: pushes the store's git versions to a PRIVATE GitHub repo. Run by backup.timer.
# Set up once: a private repo, a deploy key with write access in /opt/contextcore/.ssh/backup_key,
# then: git -C /opt/contextcore/state remote add origin git@github.com:<account>/<repo>.git
# A failed push opens one notice for the agent with the notices right; the next good push closes it.
cd /opt/contextcore/state || exit 1
N=system/notices/backup-push-failed.md
now=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
if out=$(GIT_SSH_COMMAND="ssh -i /opt/contextcore/.ssh/backup_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" git push -q origin HEAD:refs/heads/main 2>&1); then
  if [ -f "$N" ] && grep -q '^status: open' "$N"; then sed -i 's/^status: open/status: closed/' "$N"; git add -A && git commit -q -m "backup push works again"; fi
  exit 0
fi
printf '%s push failed: %s\n' "$now" "$out" >> /opt/contextcore/backup.log
if [ ! -f "$N" ] || ! grep -q '^status: open' "$N"; then
  mkdir -p system/notices
  printf -- "---\nstatus: open\nopened: %s\ntold: false\ncreated: %s\nby: server\n---\nThe off-site backup of your ContextCore data failed (%s). Your data is safe on the server; the off-site copy is older.\n" "$now" "$now" "$(printf '%s' "$out" | tail -1 | cut -c1-120)" > "$N"
  git add -A && git commit -q -m "notice: backup push failed"
fi
