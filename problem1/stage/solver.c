#include <stdio.h>
#include <time.h>

long sumEven(long n)
{
}

int main(int argc, char* argv[])
{
    struct timespec start, end;
    long n;

    scanf("%ld", &n);

    clock_gettime(CLOCK_REALTIME, &start);
    long sum = sumEven(n);
    clock_gettime(CLOCK_REALTIME, &end);

    printf("%ld\n", sum);

    long secs = end.tv_sec - start.tv_sec;
    long nanosecs = end.tv_nsec - start.tv_nsec;
    double running_time = ((double)(secs*1000000000 + nanosecs)) / 1000000000;

    fprintf(stderr, "%f\n", running_time);

    return 0;
}
