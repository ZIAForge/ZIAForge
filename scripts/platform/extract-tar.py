"""Extract a verified build archive without GNU tar's emulated openat2 path.

No absolute/traversing names, special files, duplicate outputs or overwrites.
Symlink targets stay within the destination and are created after regular files.
The caller must verify the archive checksum/source manifest separately.
"""
import os
from pathlib import Path, PurePosixPath
import shutil
import sys
import tarfile


def relative(name, strip):
    if not isinstance(name, str) or name.startswith('/') or '\\' in name:
        raise ValueError('Unsafe archive path')
    parts = [p for p in PurePosixPath(name).parts if p != '.']
    if '..' in parts:
        raise ValueError('Traversing archive path')
    return parts[strip:]


def extract(archive, destination, strip=1):
    root = Path(destination).resolve(strict=True)
    if not root.is_dir() or strip not in (0, 1):
        raise ValueError('Existing destination and supported strip count required')
    with tarfile.open(archive, 'r:*') as source:
        members = []
        seen = set()
        total = 0
        for member in source:
            parts = relative(member.name, strip)
            if not parts:
                if member.isdir():
                    continue
                raise ValueError('Empty output path')
            name = '/'.join(parts)
            if name in seen or not (member.isdir() or member.isfile() or member.issym() or member.islnk()):
                raise ValueError('Duplicate or unsupported archive entry')
            seen.add(name)
            total += member.size
            if total > 4 * 1024**3 or len(seen) > 100000:
                raise ValueError('Build archive exceeds bounded extraction size')
            target = None
            if member.issym():
                if member.linkname.startswith('/') or '\\' in member.linkname:
                    raise ValueError('Unsafe symlink target')
                target = parts[:-1].copy()
                for part in PurePosixPath(member.linkname).parts:
                    if part == '..':
                        if not target:
                            raise ValueError('Symlink escapes destination')
                        target.pop()
                    elif part != '.':
                        target.append(part)
            elif member.islnk():
                target = relative(member.linkname, strip)
                if not target:
                    raise ValueError('Empty hardlink target')
            members.append((member, parts, target))
        types = {'/'.join(parts): member for member, parts, _ in members}
        # Validate every entry before writing any archive bytes.
        for member, parts, target in members:
            for n in range(1, len(parts)):
                ancestor = types.get('/'.join(parts[:n]))
                if ancestor and not ancestor.isdir():
                    raise ValueError('Non-directory archive ancestor')
            if member.islnk():
                linked = types.get('/'.join(target))
                if linked is None or not linked.isfile():
                    raise ValueError('Hardlink must refer to an archived regular file')
            if member.issym():
                current = parts[:-1].copy()
                for part in PurePosixPath(member.linkname).parts:
                    if part == '..':
                        current.pop()
                    elif part != '.':
                        current.append(part)
                    for n in range(1, len(current) + 1):
                        linked = types.get('/'.join(current[:n]))
                        if (linked and linked.issym()) or root.joinpath(*current[:n]).is_symlink():
                            raise ValueError('Symlink target must not traverse another symlink')
            for n in range(1, len(parts) + 1):
                existing = root.joinpath(*parts[:n])
                if existing.is_symlink() or (existing.exists() and not (existing.is_dir() and (n < len(parts) or member.isdir()))):
                    raise ValueError('Refused existing output or symlink ancestor')
        for member, parts, _ in members:
            output = root.joinpath(*parts)
            output.parent.mkdir(parents=True, exist_ok=True)
            if member.isdir():
                output.mkdir(exist_ok=True)
            elif member.isfile():
                with source.extractfile(member) as stream, output.open('xb') as writer:
                    shutil.copyfileobj(stream, writer)
                output.chmod(member.mode & 0o777)
        for member, parts, target in members:
            output = root.joinpath(*parts)
            if member.issym():
                os.symlink(member.linkname, output)
            elif member.islnk():
                os.link(root.joinpath(*target), output, follow_symlinks=False)


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit('Usage: extract-tar.py VERIFIED_ARCHIVE EXISTING_DESTINATION STRIP_COUNT')
    extract(sys.argv[1], sys.argv[2], int(sys.argv[3]))
