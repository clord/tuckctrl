# Introduction

This is a piece of software I wrote over the course of two weekends to manage a chicken-coop. I plan on
expanding it to more roles in the future, such as our greenhouse, shop, and house.

Those of you who have kept chickens know that keeping the lighting and temperature nice is very important for
their health and productivity. Additionally, having a place to keep a log/journal of events is very nice.

So I wrote this tool. It lets you:

* Control lights and other AC or DC circuits
* record and log sensors
* Record and graph weather over time
* Record significant events
* View past data in both graphical and calendar form (in real time)

It does all of this with the following stack of technologies:

* Node for server-side code
* React.js for client-side presentation
* socket.io for server/client communication
* snmp-native for communicating with a little board that does the actual switching
* Redis for ephemeral storage
* Plain old text-files for archives and feeding R for graphs

I do not using this architecture for more complicated tools. This is a one-off tool for a very small number of
clients. Also, it's the app that I used to start learning bluebird/promises with, so it's partially
node-styled and partially promise-based. I'm cleaning this up over time, but it's messy and I know it.


