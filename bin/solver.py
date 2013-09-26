from sys import stdin, stderr, stdout
from time import time;

def sum_even(n):
 sum = 0
 
 for i in xrange(2, n, 2):
  sum += i
 
 return sum

n = int(stdin.read())

start = time();
result = sum_even(n)
end = time();

running_time = end - start
stdout.write('%ld\n' % result);
stderr.write('%f\n' % running_time);
