#!/bin/bash

# Kvm release script, boots vm in read only with no network interface
DISKFILE=wheezy.img

FORMAT=raw

# none
CACHE=none

# native
AIO=native

MEM=256

CORES=1

RO=on

# MONFILE="$NAME".mon
#	-chardev socket,id=charmonitor,path=$MONFILE,server,nowait \
#	-mon	chardev=charmonitor,id=monitor,mode=control \
#	-realtime mlock=off \
#	-rtc	base=utc \
#	-msg	timestamp=on

qemu-system-x86_64 \
	-enable-kvm \
	-machine pc-1.1,accel=kvm \
	-m	$MEM \
	-smp	$CORES,sockets=1,cores=$CORES,threads=1 \
	-nographic \
	-no-user-config \
	-nodefaults \
	-drive	file=$DISKFILE,readonly=$RO,if=none,id=drive-virtio-disk0,format=$FORMAT,cache=$CACHE,aio=$AIO \
	-device	virtio-blk-pci,scsi=off,bus=pci.0,addr=0x2,drive=drive-virtio-disk0,id=virtio-disk0,bootindex=1 \
	-chardev pty,id=charserial0 \
	-device	isa-serial,chardev=charserial0,id=serial0 \
	-chardev pty,id=charserial1 \
	-device	isa-serial,chardev=charserial1,id=serial1 \
	-chardev pty,id=charserial2 \
	-device virtio-serial,bus=pci.0,addr=0x3 \
	-device virtserialport,chardev=charserial2,id=serial2 \
	-device	virtio-balloon-pci,id=balloon0,bus=pci.0,addr=0x4

# Networking
#	-netdev tap,id=hostnet0,ifname=test0,script=bradd_br-vm \
#	-device virtio-net-pci,netdev=hostnet0,id=net0,bus=pci.0,addr=0x5
