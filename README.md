# FinalProject
## PetriNet Intro
Petri net is basically a network that models "places" and transitions between the "places", and it can be used in distributed systems such as cargo transportation and many other real world situations as well. Also as mentioned in the description, there are different types of networks including marked graph, free-choice net, workflow, and statemachine. The network overall is made of postions, transitions, and arcs. 
Also as known nowadays, petri net can be applied to mathematical areas such as game theory, and also it is widely used in engineering areas such as process modeling, software design, and so on.

## Installation and modeling
Install mongodb, nodejs, and npm.
Then cd into the project folder called "project", using npm install> and npm install webgme to build the basic requirement <br/>
After doing so, do "npm start" in the project folder and go http://localhost:8888 to start modeling <br/>
Then, create a new project using the seed called "mySeed", drag a PetriNet instance onto the screen and doubleclick it, draging the places and transitions components to make it a complete network. You can find a Simulation button on the left of the screeen, click it to start simulation.

## Simulation
In the simulation mode, you can go through one enabled transition, reset the network to the start, and Do classification. (Currently withour a clear tracking of markings, but is planning to deal with it)

