#!/bin/bash

# Offset in sectors
OFFSET=2048
# Image
IMAGE=wheezy.img
#IMAGE=ramfs/wheezy.img

# destination
DEST=loop
DEST2=$DEST/usr/local/sbin/vmcontroller
# input
INPUT=vmcontroller

mkdir -pv $DEST

mount -o loop,offset=$((2048*512)) $IMAGE $DEST
cp -v "$INPUT" "$DEST2"
umount "$DEST"
rmdir "$DEST"
sync
