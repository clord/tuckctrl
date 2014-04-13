library('ggplot2')
library('reshape2')

eggdata = read.csv("templog/egg.log", sep="\t", header=F, col.names=c("date", "eggs"))
dfeg <- data.frame(time=as.POSIXlt(eggdata$date, origin="1970-01-01"), eggs=eggdata$eggs, src="Eggs")

p <- ggplot(dfeg, aes(x=time, y=eggs, colour=src)) 
p <- p + geom_line() 
p <- p + geom_smooth()
p <- p + xlab("")
p <- p + ylab("")
p <- p + theme(aspect.ratio=2) 
p <- p + scale_colour_discrete(name = "")
p <- p + theme_bw()
p <- p + theme(legend.position="top", legend.direction="horizontal")
ggsave(file="public/images/eggs-over-time.svg", plot=p, width=10, height=5)

