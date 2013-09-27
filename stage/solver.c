#include <stdio.h>
#include <sys/time.h>

long sumEven(long n)
{
n = (n - 1)/2;
return (n + 1)*n;
}

int main(int argc, char* argv[])
{
    struct timeval start, end;
    long n;

    scanf("%ld", &n);

    gettimeofday(&start, 0);
    long sum = sumEven(n);
    gettimeofday(&end, 0);

    printf("%ld\n", sum);

    long secs = end.tv_sec - start.tv_sec;
    long millisecs = end.tv_usec - start.tv_usec;
    double running_time = ((double)(secs*1000000 + millisecs)) / 1000000;

    fprintf(stderr, "%f\n", running_time);

    return 0;
}
