# Security policy

Northern Lights holds people's private photos and messages, so we take security
reports seriously.

## Reporting a vulnerability

Please **don't** open a public issue. Instead, use GitHub's private reporting:
go to the repository's **Security** tab and choose
[**Report a vulnerability**](https://github.com/yeixio/northern-lights/security/advisories/new).
Only the maintainers can see the report.

Include what you found, how to reproduce it, and what an attacker could do with
it. We'll acknowledge the report within a few days, keep you updated while we
work on a fix, and credit you in the release notes unless you'd rather we didn't.

## Supported versions

Fixes go into the latest release. Please check that the problem still happens
on the newest version (or `main`) before reporting.

## Scope

Especially interesting: anything that lets a visitor see members-only posts,
photos, albums or messages; lets a member act as another member or as an admin;
or bypasses the invite-only sign-up. Problems that need an admin's own password
or access to the server's files are generally out of scope.
