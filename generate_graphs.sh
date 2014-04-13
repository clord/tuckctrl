#!/bin/zsh
set -e
cd /home/clord/tucktuck

name=$1

# Make some nice smooth graphs
parallel "smoother/dist/build/smoother/smoother -t 0 -d 1 2d < {} > {.}.smooth" ::: templog/coop-*.log
smoother/dist/build/smoother/smoother -h -t 0 -d 1 2d < templog/weather.log > templog/weather.smooth

R --no-save < $name.r 
