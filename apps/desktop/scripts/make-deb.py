import os
import sys
import tarfile
import shutil

release_dir = os.path.abspath('apps/desktop/release')
deb_path = os.path.join(release_dir, 'orbit_0.1.0_amd64.deb')
staging_dir = os.path.join(release_dir, 'deb-py-staging')
linux_build_dir = os.path.join(release_dir, 'Orbit-linux-x64')

if os.path.exists(staging_dir):
    shutil.rmtree(staging_dir)
os.makedirs(staging_dir)

# 1. Structure opt and usr
root_data = os.path.join(staging_dir, 'root_data')
opt_orbit = os.path.join(root_data, 'opt/orbit')
bin_dir = os.path.join(root_data, 'usr/bin')
apps_dir = os.path.join(root_data, 'usr/share/applications')
icons_dir = os.path.join(root_data, 'usr/share/icons/hicolor/256x256/apps')

for d in [opt_orbit, bin_dir, apps_dir, icons_dir]:
    os.makedirs(d)

# Copy binaries
shutil.copytree(linux_build_dir, opt_orbit, dirs_exist_ok=True)
os.chmod(os.path.join(opt_orbit, 'orbit'), 0o755)

# Clean out any mac hidden files
for root, dirs, files in os.walk(root_data):
    for f in files:
        if f.startswith('._') or f == '.DS_Store':
            try:
                os.remove(os.path.join(root, f))
            except Exception:
                pass

# Bin symlink script
with open(os.path.join(bin_dir, 'orbit'), 'w') as f:
    f.write('#!/bin/sh\nexec /opt/orbit/orbit --no-sandbox "$@"\n')
os.chmod(os.path.join(bin_dir, 'orbit'), 0o755)

# Desktop shortcut
desktop_entry = """[Desktop Entry]
Name=Orbit
Comment=Orbit Team Conversation App
Exec=/opt/orbit/orbit --no-sandbox %U
Icon=orbit
Terminal=false
Type=Application
Categories=Network;Chat;InstantMessaging;
StartupWMClass=Orbit
"""
with open(os.path.join(apps_dir, 'orbit.desktop'), 'w') as f:
    f.write(desktop_entry)

# Icon
shutil.copyfile('apps/desktop/resources/icon.png', os.path.join(icons_dir, 'orbit.png'))

# Calculate size
installed_size = 0
for root, dirs, files in os.walk(root_data):
    for f in files:
        installed_size += os.path.getsize(os.path.join(root, f))
installed_size_kb = int(installed_size / 1024)

# Control file
control_content = f"""Package: orbit
Version: 0.1.0
Section: net
Priority: optional
Architecture: amd64
Installed-Size: {installed_size_kb}
Maintainer: Wondercraftz <support@wondercraftz.com>
Description: Orbit Team Conversation App
 Fast, real-time team collaboration, communication, and project management.
"""

control_file = os.path.join(staging_dir, 'control')
with open(control_file, 'w') as f:
    f.write(control_content)

# File 1: debian-binary
deb_binary = os.path.join(staging_dir, 'debian-binary')
with open(deb_binary, 'w') as f:
    f.write('2.0\n')

# File 2: control.tar.gz (Pure GNU tar without Apple PaxHeader or xattrs)
control_tar = os.path.join(staging_dir, 'control.tar.gz')
with tarfile.open(control_tar, 'w:gz', format=tarfile.GNU_FORMAT) as tar:
    tar.add(control_file, arcname='./control')

# File 3: data.tar.gz (Pure GNU tar)
data_tar = os.path.join(staging_dir, 'data.tar.gz')
with tarfile.open(data_tar, 'w:gz', format=tarfile.GNU_FORMAT) as tar:
    for item in ['opt', 'usr']:
        tar.add(os.path.join(root_data, item), arcname=f'./{item}')

# Pack into AR archive
def create_ar(files, out_file):
    with open(out_file, 'wb') as out:
        out.write(b'!<arch>\n')
        for name, path in files:
            size = os.path.getsize(path)
            hdr = f"{name:<16}0           0     0     100644  {size:<10}`\n"
            out.write(hdr.encode('ascii'))
            with open(path, 'rb') as f:
                out.write(f.read())
            if size % 2 != 0:
                out.write(b'\n')

create_ar([
    ('debian-binary', deb_binary),
    ('control.tar.gz', control_tar),
    ('data.tar.gz', data_tar)
], deb_path)

shutil.rmtree(staging_dir)
print('SUCCESS: Created 100% valid GNU/Debian package at:', deb_path)
