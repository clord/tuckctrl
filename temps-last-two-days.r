library('ggplot2')
library('reshape2')
library('zoo')

maindata  = read.csv("templog/coop-Main Coop.log", sep="\t", header=F, col.names=c("date","temp"))
entrydata = read.csv("templog/coop-Entryway.log",  sep="\t", header=F, col.names=c("date","temp"))
nestdata  = read.csv("templog/coop-Nestboxes.log",  sep="\t", header=F, col.names=c("date","temp"))
outside   = read.csv("templog/weather.log",  sep="\t", header=T)

maindata$date = as.POSIXlt(maindata$date, origin="1970-01-01")
entrydata$date = as.POSIXlt(entrydata$date, origin="1970-01-01")
nestdata$date = as.POSIXlt(nestdata$date, origin="1970-01-01")
outside$dt = as.POSIXlt(outside$dt, origin="1970-01-01")

maindata <- maindata[which(as.Date(maindata$date) > (Sys.Date() - 8)),]
entrydata <- entrydata[which(as.Date(entrydata$date) > (Sys.Date() - 8)),]
nestdata <- nestdata[which(as.Date(nestdata$date) > (Sys.Date() - 8)),]
outside <- outside[which(as.Date(outside$dt) > (Sys.Date() - 8)),]

ats1 <- approx(entrydata$date, entrydata$temp, n=1150)
ats2 <- approx(maindata$date, maindata$temp, n=1150)
ats3 <- approx(nestdata$date, nestdata$temp, n=1150)
ats9 <- approx(outside$dt, outside$temp, n=1150)
min1 <- rollapply(ats1$y-0.5,5, min, align="center", na.pad=TRUE)
max1 <- rollapply(ats1$y+0.5,5, max, align="center", na.pad=TRUE)
min2 <- rollapply(ats2$y-0.5,5, min, align="center", na.pad=TRUE)
max2 <- rollapply(ats2$y+0.5,5, max, align="center", na.pad=TRUE)
min3 <- rollapply(ats3$y-0.5,5, min, align="center", na.pad=TRUE)
max3 <- rollapply(ats3$y+0.5,5, max, align="center", na.pad=TRUE)
min9 <- rollapply(ats9$y-0.5,5, min, align="center", na.pad=TRUE)
max9 <- rollapply(ats9$y+0.5,5, max, align="center", na.pad=TRUE)

dfe  <- data.frame(time=as.POSIXlt(ats1$x, origin="1970-01-01"), temp=ats1$y, temp.hi=max1, temp.lo=min1, src="Entry")
dfm  <- data.frame(time=as.POSIXlt(ats2$x, origin="1970-01-01"), temp=ats2$y, temp.hi=max2, temp.lo=min2, src="Main")
dfn  <- data.frame(time=as.POSIXlt(ats3$x, origin="1970-01-01"), temp=ats3$y, temp.hi=max3, temp.lo=min3, src="Nestboxes")
dfo  <- data.frame(time=as.POSIXlt(ats9$x, origin="1970-01-01"), temp=ats9$y, temp.hi=max9, temp.lo=min9, src="Outside")

df = rbind(dfe, dfm, dfo, dfn)

p <- ggplot(data=df, aes(x=time, y=temp, ymin=temp.lo, ymax=temp.hi, fill=src)) 
p <- p + geom_line(alpha="0.9")
p <- p + geom_ribbon(alpha="0.5")
p <- p + xlab("")
p <- p + ylab("")
p <- p + theme(aspect.ratio=1.0) 
p <- p + scale_colour_discrete(name = "")
p <- p + theme_bw()
p <- p + theme(legend.position="bottom", legend.direction="horizontal")

ggsave(file="public/images/temps-last-two-days.svg", plot=p, width=10, height=10)


