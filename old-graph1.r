maindata  = read.csv("templog/coop-Main Coop.log", sep="\t", header=F, col.names=c("date","temp"))
entrydata = read.csv("templog/coop-Entryway.log",  sep="\t", header=F, col.names=c("date","temp"))
outside   = read.csv("templog/weather.log",  sep="\t", header=T)

ts1 <- approx(entrydata$date, entrydata$temp, n=650)
ts2 <- approx(maindata$date, maindata$temp, n=650)
ts3 <- approx(outside$dt, outside$temp, n=550)

# First Plot
svg(filename="public/images/temp-over-time.svg")

p<-plot(as.POSIXlt(ts1$x,origin="1970-01-01"), ts1$y, type='l', xlab="Date", ylab="Temperature", yaxs="i",xaxs="i", ylim=c(-38,38),bty = 'n')
abline(h=c(0),lty="11",col="gray")
grid(NULL, NULL, lty=6, col = "cornsilk2")
# lines(as.POSIXlt(ts1$x,origin="1970-01-01"), ts1$y, col='black')
lines(as.POSIXlt(ts2$x,origin="1970-01-01"), ts2$y, col='red')
lines(as.POSIXlt(ts3$x,origin="1970-01-01"), ts3$y, col='blue')
dev.off();


