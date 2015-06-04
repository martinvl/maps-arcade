n = 100
m = 1000000

a = []
b = []

common=1

astart = 1999999
bstart = 2000000

while n > 1:
    a.append(astart)
    astart -= 2*10000
    n -= 1

while m > 1:
    b.append(bstart)
    bstart -= 2
    m -= 1

a.append(1)
b.append(1)

print len(a)
print " ".join([str(i) for i in a])
print len(b)
print " ".join([str(i) for i in b])
