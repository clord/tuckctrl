library('ggplot2')
library('reshape2')
library('zoo')

maindata  = read.csv("templog/coop-Main Coop.smooth" , sep="\t", header=F, col.names=c("date","temp", "min", "max"))
entrydata = read.csv("templog/coop-Entryway.smooth"  , sep="\t", header=F, col.names=c("date","temp", "min", "max"))
nestdata  = read.csv("templog/coop-Nestboxes.smooth" , sep="\t", header=F, col.names=c("date","temp", "min", "max"))
outside   = read.csv("templog/weather.smooth"        , sep="\t", header=F, col.names=c("date","temp", "min", "max"))

ats1 <- approx(entrydata$date, entrydata$temp, n=200)
ats2 <- approx(maindata$date,  maindata$temp,  n=200)
ats3 <- approx(nestdata$date,  nestdata$temp,  n=200)
ats9 <- approx(outside$date,   outside$temp,   n=200)

min1 <- approx(entrydata$date, entrydata$min,  n=200)
min2 <- approx(maindata$date,  maindata$min,   n=200)
min3 <- approx(nestdata$date,  nestdata$min,   n=200)
min9 <- approx(outside$date,   outside$min,    n=200)

max1 <- approx(entrydata$date, entrydata$max,  n=200)
max2 <- approx(maindata$date,  maindata$max,   n=200)
max3 <- approx(nestdata$date,  nestdata$max,   n=200)
max9 <- approx(outside$date,   outside$max,    n=200)



dfe  <- data.frame(time=as.POSIXlt(ats1$x, origin="1970-01-01"), temp=ats1$y, temp.hi=max1$y, temp.lo=min1$y, src="Entry")
dfm  <- data.frame(time=as.POSIXlt(ats2$x, origin="1970-01-01"), temp=ats2$y, temp.hi=max2$y, temp.lo=min2$y, src="Main")
dfn  <- data.frame(time=as.POSIXlt(ats3$x, origin="1970-01-01"), temp=ats3$y, temp.hi=max3$y, temp.lo=min3$y, src="Nestboxes")
dfo  <- data.frame(time=as.POSIXlt(ats9$x, origin="1970-01-01"), temp=ats9$y, temp.hi=max9$y, temp.lo=min9$y, src="Outside")

df = rbind(dfe, dfm, dfo, dfn)

p <- ggplot(data=df, aes(x=time, y=temp, ymin=temp.lo, ymax=temp.hi, fill=src)) 
p <- p + geom_line(alpha="0.9")
p <- p + geom_ribbon(alpha="0.5")
p <- p + xlab("")
p <- p + ylab("")
p <- p + theme(aspect.ratio=2.0) 
p <- p + scale_colour_discrete(name = "")
p <- p + theme_bw()
p <- p + theme(legend.position="top", legend.direction="horizontal")
ggsave(file="public/images/temp-over-time.svg", plot=p, width=10, height=5)


