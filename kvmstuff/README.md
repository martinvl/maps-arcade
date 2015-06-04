## Servers
* nodeserver 178.62.246.106 / 10.133.234.169
* eval1	     178.62.246.106

## Setup
* sudo apt-get install qemu-kvm qemu-system python-serial python-pip
* sudo pip install websocket-client
* Should be about it for root users

## The different files
* DEPS.md - list of dependencies for running controller.py
* controller.py - the evalserver that controls virtual machines and communicates with the backend
* just\_do\_it, kvm.sh, kvm-release.sh - scripts for booting a VM so we can work on it
* loop.sh - mount the disk image in a host directory
* vmcontroller - script that goes into the virtual machine. resides in /usr/local/sbin/ and is kept running by init.
 * inittab line: T1:23:respawn:/usr/local/sbin/vmcontroller ttyS1 vport0p1
 * The script sends data up via ttyS1 and receives data via vport0p1
 * This was done this way because:
  * Writing large data into the host ttyS1 hung the vm and dropped the data
  * vport0p1 was damn fast but only worked in one direction
  * the hang problem does not seem to go the other way, so this solution works for arbitrary data sizes
  * vm -> host comms can be a bit slow for large returns, but unlimited printing crashes the VM instead
  * POTENTIAL PROBLEM: I think you could write (from the program) an optimal size of ~50MB or so where the VM will slowly send the whole thing back and make the whole system hang while this happens
 * IMPORTANT CHANGE:
  * The measured time is done in vmcontroller instead of trusting the program, this gives less accurate times, but they are more secure and hopefully good *enough*
  * This can be changed without too much effort.
* vmtester - python script used to communicate with vmcontroller to make sure it works and test such problems as described above.

## PROTOCOL - BACKEND - EVALUATOR
* client will be the evaluation server
* server will be the backend server
* messages sent with json encoded:
 * event - string eventname
 * data - some object, event data
* When a client connects, it sends event ready and event freeslots
* When server receives the event ready, it sends the huge packet "problem" back
 * NOTE: in the future, it might only send a list of problems where we would ask for more information
* Whenever server wants to, it sends a submission
 * Client queues this submission
 * In order to reduce unneccesary waiting, the server knows the number of free slots per server via the freeslots event. This way, the server knows if sending a task to a particular client will cause a delay
 * clients can hold unlimited amounts of tasks in queue, even when they have 0 free slots.
### Events
* event: ready
 * From client
 * data:
  * name: str machinename
* event: freeslots
 * From client
 * data:
  * cur: int ready slots
  * max: int maximum slots
* event: problem
 * From server
 * data:
  * id: string, problemname
  * timelimit: int, seconds
  * memlimit: int, MB. 0 for unlimited
  * assembly =>
   * language (c/java/python) =>
    * head: string
    * tail: string
  * test =>
   * id: string
   * input: string
   * answer: string
* event: submission
 * Sent by server
 * data:
  * submissionId
  * language
  * src
* event: compile
 * Sent by client when program is ready to get test cases and execute
 * data:
  * submissionId
  * success: compiler return code. 0 for success
  * stderr: compiler output
  * src: code fed to the compiler
* event: eval
 * Sent by client when a test case completes
 * data:
  * submissionId
  * testcaseId
  * success (0 for success, 1 for wrong, 2 for crash, 3 for timeout)
  * stderr
  * walltime (float)
* event: endsub
 * Sent by client when a submissionId has been closed and forgotten
 * If error, this can be sent prematurely
 * data:
  * submissionId
  * errstr: if nonempty, there was a non-program-specific error

## IDEA
* Controller boots up vm
* VM informs the controller that it is idle
* Controller informs VM of a task
* VM compiles and gives feedback to controller before and after the compilation
* When seeing the compilation started message, controller sets a hard timeout
* When seeing the compilation completed message, the controller resets the timeout and starts feeding the VM testcases.
* VM gets a test case and reports back, VM gets told to start executing, and returns stdout, returncode and stderr
* When controller is informed that execution has started, the controller sets a hard limit for the VM
* VM script runs as root but drops privileges for compiler and execution
* VM informs controller when started
* Controller sets a hard time limit (kill the box)
* VM contacts controller with results within time limit
* Whenever an error happens or the controller is done testing, it kills the VM.

## Controller logic
* Controller has a task queue
* Controller always keeps N machines running
* When the queue gets a task and it has free VMs, launch a VM against a task, see how above..
 * A single VM tests one submission with all test cases.
* The VM is killed, so the controller starts a new one.
* This keeps the system responsive as VMs are booted ahead of the task. When the controller counts a slot as free, the corresponding VM is booted and ready.

## VMs vs network
* VMs have no network, everything happens over console1/2 in JSON format.

## TODO
* vmcontroller needs to kill processes that output too much data
 * or at least cap to 1MB whatever is sent back up the pipe
* vmcontroller needs a serious API cleanup (implementation of error codes and stuff)
