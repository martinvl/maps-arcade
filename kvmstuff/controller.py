#!/usr/bin/python

# Kills VMs 5 seconds after time limit


from subprocess import *
import re
from serial import Serial
from select import select
import json
import time
import websocket
import sys
from Queue import Queue

# local imports
import config

def vmselect(vms, sock):
	rlist = [x.ctrl_in for x in vms]
	if sock != None:
		rlist.append(sock)
	out = select(rlist, [], [], 1)
	out = out[0]
	rvms = []
	for vm in vms:
		if vm.ctrl_in in out:
			rvms.append(vm)
	thesock = None
	if sock in out:
		thesock = sock
	return (rvms, thesock)

class VM:
	disk  = config.disk
	fmt   = "raw"
	cache = config.cache
	aio   = "native"
	mem   = "256"
	cores = "1"
	ro    = "on"

	def __init__(self, id):
		self.root_pts = None
		self.ctrl_in_pts = None
		self.ctrl_out_pts = None
		self.ctrl_in = None
		self.ctrl_out = None
		self.id = id

		# ready: If the machine is booted
		self.ready = False

		# hassub: If the machine has a current submission
		self.hassub = False
		# Submission data: src, language, submissionId
		self.submissionId = None
		# Current testcase (iterator) - None if unstarted
		self.testcases = None
		self.testcase = None
		self.test = None
		self.code = None

		# expiry: after this time, the vm will be timed out and killed
		# None for no expiry
		self.expiry = None

		# To measure startup delay
		self.beginstart = time.time()

		# Launch
		cmd = [
			"qemu-system-x86_64",
			"-machine",	"pc-1.1,accel=kvm",
			"-m",		VM.mem,
			"-smp",		VM.cores+",sockets=1,cores="+VM.cores+",threads=1",
			"-nographic",
			"-no-user-config",
			"-nodefaults",
			# Disk - 0x2
			"-drive",	"file="+VM.disk+",readonly="+VM.ro+",if=none,id=drive-virtio-disk0,format="+VM.fmt+",cache="+VM.cache+",aio="+VM.aio,
			"-device",	"virtio-blk-pci,scsi=off,bus=pci.0,addr=0x2,drive=drive-virtio-disk0,id=virtio-disk0,bootindex=1",
			# Root tty
			"-chardev",	"pty,id=charserial0",
			"-device",	"isa-serial,chardev=charserial0,id=serial0",
			# input pipe
			"-chardev",	"pty,id=charserial1",
			"-device",	"isa-serial,chardev=charserial1,id=serial1",
			# output pipe
			"-device",	"virtio-serial,bus=pci.0,addr=0x3",
			"-chardev",	"pty,id=charserial2",
			"-device",	"virtserialport,chardev=charserial2,id=serial2",
			# test tty - 0x3
			# This stuff - 0x4
			"-device",	"virtio-balloon-pci,id=balloon0,bus=pci.0,addr=0x4",
		]
		self.p = Popen(cmd, stdout=None, stdin=None, stderr=PIPE)
		self.getpts()
		self.getpts()
		self.getpts()
		if self.root_pts == None or self.ctrl_in_pts == None or self.ctrl_out_pts == None:
			self.kill()
			print "Options: ", " ".join(cmd)
			raise Exception("Error launching virtual machine")
			return
		self.ctrl_in = Serial(self.ctrl_in_pts, interCharTimeout=1)
		self.ctrl_out = Serial(self.ctrl_out_pts, writeTimeout=20)
		self.beginstart = time.time()

	def __destroy__(self):
		self.kill()

	def endsub(self, errstr=""):
		if self.hassub:
			ws.endsub(self.submissionId, errstr)
			self.hassub = False

	def getpts(self):
		r = re.compile('.*(/dev/pts/\d+).*')
		line = self.p.stderr.readline()
		m = r.match(line)
		if m != None:
			g = m.groups()
			pts = g[0]
			if self.root_pts == None:
				print "VM id "+str(self.id)+" has root serial at "+pts
				self.root_pts = pts
			elif self.ctrl_in_pts == None:
				self.ctrl_in_pts = pts
			elif self.ctrl_out_pts == None:
				self.ctrl_out_pts = pts

	def kill(self):
		print "Killing VM id "+str(self.id)+" (pid "+str(self.p.pid)+")"
		if self.p:
			try:
				# Signal
				self.p.terminate()
			except OSError as e:
				pass
			self.p.wait() # Wait for return
		self.p = None
		self.endsub("VM killed for unknown reason")
		self.ready = False

	def alive(self):
		if self.p == None:
			return False
		if self.p.poll() != None:
			self.endsub("VM died for unknown reason")
			return False
		return True

	def serread(self):
		lengthstr = ""
		while True:
			char = self.ctrl_in.read()
			if char == '\n':
				break
			elif len(char) == 0:
				break
			else:
				lengthstr += char
		if len(lengthstr) == 0:
			return None
		length = int(lengthstr)
		data = self.ctrl_in.read(length+1)
		return json.loads(data)

	def serwrite(self, data):
		enc = json.dumps(data)
		print "VM id "+str(self.id)+" sending "+str(len(enc))+" json bytes to VM"
		self.ctrl_out.write(str(len(enc))+"\n"+enc+"\n")

	def read(self):
		try:
			data = self.serread()
		except Exception as e:
			print "Read from VM exception: "+str(e)
			return

		if data == None:
			print "(None)"
			return

		# Errors!
		if data["cmd"] == 'err':
			errstr = data["str"]
			self.endsub(errstr)
			self.kill()
			return

		if data["cmd"] == "ready" and not self.ready:
			self.ready = True
			delay = time.time() - self.beginstart
			print "VM id "+str(self.id)+" is ready (took "+str(delay)+" seconds)"
			return
		elif data["cmd"] == "ready":
			print "VM id "+str(self.id)+" has crashed and rebooted vmcontroller"
			self.endsub("VM crashed and rebooted controller script")
			self.kill()
			return

		if data["cmd"] == "compile" and data["status"] == "started":
			# Set watchdog
			self.expiry = time.time() + config.compiletime + 5
			# Not interested
			return

		if data["cmd"] == "compile":
			# Unset watchdog
			self.expiry = None
			ws.compile(self.submissionId, data["status"], data["out"], self.code)
			if data["status"] != 0:
				print data["out"]
				self.endsub("Program failed to compile")
				self.kill()
				return
			self.sub_testcase()
			return

		if data["cmd"] == "testcase":
			# Testcase is uploaded, launch it
			self.serwrite({"cmd":"run", "ram":problem["memlimit"], "time":problem["timelimit"]})
			return

		if data["cmd"] == "run" and data["status"] == "started":
			# 5 extra seconds (way overkill, but oh well...
			self.expiry = time.time() + problem["timelimit"]+5
			return

		if data["cmd"] == "run":
			self.expiry = None
			# Inspect status to find out more detailed
			status = data["status"]
			status2 = None
			stdout = data["out"]
			stderr = data["err"]
			try:
				wtime = float(stderr)
			except:
				print "Fallback to walltime"
				wtime  = data["walltime"]
			# TODO: Maybe a less strict compare, or rules set by testcase?

			# Crash codes - -11 = sigsegv, -24 = cpu limit
			# negaive statuses are signals
			if status == -24 or wtime > problem["timelimit"]:
				status2 = 3 # Timeout, hard or soft
			elif status < 0:
				status2 = 2 # Crash
			elif status != 0:
				# Catch-all crash
				status2 = 2
			elif stdout != self.test["output"]:
				status2 = 1 # Wrong
			else:
				# Finally
				status2 = 0 # Correct


			# Continue whatever happens if it's optional
			if self.test["optional"] and (status2 == 2 or status2 == 3):
				wtime = float(problem["timelimit"])
				status2 = 0

			ws.eval(self.submissionId, self.testid, status2, stderr, wtime)
			if status2 != 0:
				# A failed test case
				self.endsub()
				self.kill()
				return
			# Next testcase
			self.sub_testcase()
			return

		raise Exception("VM id "+str(self.id)+" reading: "+str(data))


	def timed(self):
		if self.expiry != None and time.time() > self.expiry:
			self.endsub("VM timelimit exceeded")
			self.kill()

	def sub_testcase(self):
		# Next testcase
		if self.testcases == None:
			self.testcases = sorted(problem["test"].keys())
			print self.testcases

		if self.testcase == None:
			self.testcase = 0
		else:
			self.testcase += 1

		if self.testcase >= len(self.testcases):
			# Feedback has been given on the last testcase
			self.endsub()
			self.kill()
			return

		print "Getting testcase "+str(self.testcase+1)+" of "+str(len(self.testcases))

		self.testid = self.testcases[self.testcase]
		self.test = problem["test"][self.testid]
		# Send to VM
		self.serwrite({"cmd":"testcase", "text": self.test["input"]})

	def sub_start(self, sub):
		print "Submission id "+str(sub["submissionId"])+" assigned to VM id "+str(self.id)
		lang = sub["language"]
		self.hassub = True
		self.submissionId = sub["submissionId"]
		assembly  = problem["assembly"][lang]["head"]
		assembly += sub["src"]
		assembly += problem["assembly"][lang]["tail"]
		self.code = assembly

		self.serwrite({"cmd":         "compile",
			       "lang":        lang,
			       "compiletime": config.compiletime,
			       "code":        assembly})

class VMmgr:
	def __init__(self, num):
		self.vms = []
		self.num = num
		self.vmid = 0
		# Current ready vms
		self.cur = 0

	def __destroy__(self):
		for vm in self.vms:
			vm.kill()

	def freeslots(self):
		cnt = 0
		for vm in self.vms:
			if vm.ready and not vm.hassub:
				cnt = cnt+1
		# cur, max
		return cnt

	def checkfreeslots(self, force=False):
		cur = self.freeslots()
		prev = self.cur
		if cur != prev or force:
			# Time to update
			self.cur = cur
			ws.freeslots((cur, self.num))

	def boot(self):
		while len(self.vms) < self.num:
			vm = VM(self.vmid)
			self.vmid = self.vmid+1
			self.vms.append(vm)

	def purgedead(self):
		new = []
		altered = False
		for vm in self.vms:
			if not vm.alive():
				altered = True
			else:
				new.append(vm)
		self.vms = new
		if altered:
			self.checkfreeslots()

	def readlist(self, readvms):
		# Run reading events
		for vm in readvms:
			vm.read()
			# Remove here as well
			if not vm.alive():
				self.vms.remove(vm)

	def timeds(self):
		# Run timed events
		for vm in self.vms:
			vm.timed()

	def assign(self, sub):
		# Assign a submission to a VM
		for vm in self.vms:
			if vm.alive() and vm.ready and not vm.hassub:
				vm.sub_start(sub)
				return
		raise Exception("VMmgr.assign(): No VM available")

class upstream:
	def __init__(self, name, addr, timeout):
		self.ws      = None
		self.addr    = addr
		self.timeout = timeout
		self.name    = name

	def recv(self):
		data = self.ws.recv()
		stuff = json.loads(data)
		return (stuff["event"], stuff["data"])

	def send(self, event, data):
		out = {
			"event": str(event),
			"data": data
		}
		print "ws -> send: ", out
		if self.ws:
			self.ws.send(json.dumps(out))
		else:
			print "Lost websockets write ("+str(event)+")"

	def connected(self):
		if self.ws == None:
			return False
		return True

	def connect(self):
		try:
			self.ws = websocket.create_connection(self.addr, self.timeout)
		except Exception as e:
			print "upstream: could not connect: "+str(e)
			self.ws = None
	def getws(self):
		return self.ws

	# Client initiative functions
	def ready(self):
		self.send("ready", {"name":self.name})

	def freeslots(self, curmax):
		self.send("freeslots", {"cur":curmax[0], "max":curmax[1]})

	def compile(self, sid, success, stderr, src):
		self.send("compile", {"submissionId": sid, "success": success, "stderr": stderr, "src": src})

	def endsub(self, sid, errstr=""):
		self.send("endsub", {"submissionId": sid, "errstr": errstr})

	def eval(self, sid, testid, success, stderr, walltime):
		self.send("eval", {"submissionId": sid, "testId": testid, "success": success, "stderr": stderr, "walltime": walltime})

	# Incoming stuff
	def read(self):
		try:
			event, data = self.recv()
		except Exception as e:
			print "Lost upstream connection: "+str(e)
			self.ws = None
			return
		print "From server: "
		print event
		if event != "problem":
			print data
		else:
			print "[ data not shown ]"

		if event == "problem":
			self.on_problem(data)
			return

		if event == 'submission':
			print "Submission -> queue: id "+str(data["submissionId"])
			subq.put(data)
			return

		print "Event: "+event
		print data

	def on_problem(self, data):
		# Sometimes, this is easier to manage than going through everything
		global problem
		problem = data

		# Correct for optional not always being present
		for prob in problem["test"]:
			p = problem["test"][prob]
			if not "optional" in p:
				p["optional"] = False

# Connect to websockets (try, at least)
ws = upstream(config.name, config.connect, config.connect_timeout)

# One VM per core so we can guarantee a core per vm
vmmgr = VMmgr(config.numvms)

# Problem config
problem = None

# Submission queue
subq = Queue()

# Kill away junk
p = Popen(["pkill", "qemu-system"], stdout=None, stderr=None, stdin=None)
p.wait()

vmid = 0
vmlist = []
while True:
	# Make enough VMs
	vmmgr.boot()

	if not ws.connected():
		ws.connect()
		if ws.connected():
			ws.ready()
			vmmgr.checkfreeslots(True) # Force freeslots update

	# Socket = Our communication to the outside world
	readvms, rsock = vmselect(vmmgr.vms, ws.getws())

	if rsock != None:
		print "Reading from websocket"
		ws.read()

	vmmgr.readlist(readvms)
	vmmgr.timeds()
	# Remove dead ones
	vmmgr.purgedead()

	if not subq.empty() and vmmgr.freeslots() > 0:
		vmmgr.assign(subq.get())

	vmmgr.checkfreeslots()

# vim: set noexpandtab softtabstop=8 tabstop=8 shiftwidth=8:
