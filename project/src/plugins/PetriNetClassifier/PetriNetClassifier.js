define([
  "plugin/PluginConfig",
  "text!./metadata.json",
  "plugin/PluginBase",
], function (PluginConfig, pluginMetadata, PluginBase) {
  "use strict";

  pluginMetadata = JSON.parse(pluginMetadata);

  function PetriNetClassifier() {
    PluginBase.call(this);
    this.pluginMetadata = pluginMetadata;
  }

  PetriNetClassifier.metadata = pluginMetadata;
  PetriNetClassifier.prototype = Object.create(PluginBase.prototype);
  PetriNetClassifier.prototype.constructor = PetriNetClassifier;

  PetriNetClassifier.prototype.main = function (callback) {
    const self = this;
    const nodeObject = self.activeNode;

    self.core.loadOwnSubTree(
	  self.activeNode, 
	  (error, nodes) => {
	  self.myNodes = nodes;
	  if (self.isStateMachine()) {
        self.sendNotification({
          message: "State Machine",
        });
      }
      if (self.isMarkedGraph()) {
        self.sendNotification({
          message: "Marked Graph",
        });
      }
	  if (self.isFreeChoice()) {
        self.sendNotification({
          message: "Free Choice",
        });
      }
	  self.sendNotification({
          message: "Sorry for no workflow classifier :)",
        });
    });
  };

  PetriNetClassifier.prototype.getO_I = function (pid,tid) {
	let self = this;
	let myArcs = [];
    let getCurID = (arc, pointerName) => {
      return self.core.getPointerPath(arc, pointerName);
    };
    self.myNodes.forEach((node) => {
      if (self.core.getAttribute(self.core.getMetaType(node), "name") === "ArcP_T") {
        myArcs.push({
          src: getCurID(node, "src"),
          dst: getCurID(node, "dst"),
        });
      }
    });
    return myArcs.some((arc) => {
      return arc.src === pid && arc.dst === tid;
    });
  };
  
  PetriNetClassifier.prototype.getI_O = function (pid,tid) {
	let self = this;
	let myArcs2 = [];
    let getCurID = (arc, pointerName) => {
      return self.core.getPointerPath(arc, pointerName);
    };
    self.myNodes.forEach((node) => {
      if (self.core.getAttribute(self.core.getMetaType(node), "name") === "ArcT_P") {
        myArcs2.push({
          src: getCurID(node, "src"),
          dst: getCurID(node, "dst"),
        });
      }
    });
    return myArcs2.some((arc) => {
      return arc.src === tid && arc.dst === pid;
    });
  };

  PetriNetClassifier.prototype.isStateMachine = function () {
    let self = this;
	let transit = self.myNodes.filter((node) => {
        let meta = self.core.getAttribute(self.core.getMetaType(node), "name");
        return meta === "Transition";
      }).map((transition) => {
        return {id: self.core.getPath(transition),node: transition,};
	  });
    return transit.every((trans) => {
      return (
        Object.keys(self.getOut()).filter(
          (placeId) => self.getOut()[placeId][trans.id]
        ).length == 1 &&
        Object.keys(self.getIn()).filter(
          (placeId) => self.getIn()[placeId][trans.id]
        ).length == 1
      );
    });
  };

  PetriNetClassifier.prototype.isMarkedGraph = function () {
    let self = this;
	let myPlace = self.myNodes.filter((node) => {
        let meta = self.core.getAttribute(self.core.getMetaType(node), "name");
        return meta === "Place";
      }).map((place) => {
        return {id: self.core.getPath(place),node: place,};
      });
    return myPlace.every((place) => {
      return (
        Object.keys(self.getOut()[place.id]).filter(
          (transId) => self.getOut()[place.id][transId]
        ).length == 1 &&
        Object.keys(self.getIn()[place.id]).filter(
          (transId) => self.getIn()[place.id][transId]
        ).length == 1
      );
    });
  };

  PetriNetClassifier.prototype.isFreeChoice = function () {
	let self = this;
    let map = {};
    let intersection = (arr1, arr2) => {
      return arr1.filter((val) => arr2.includes(val));
    };
	let transit = self.myNodes.filter((node) => {
        let meta = self.core.getAttribute(self.core.getMetaType(node), "name");
        return meta === "Transition";
      }).map((transition) => {
        return {id: self.core.getPath(transition),node: transition,};
	  });
    transit.forEach((trans) => {
      map[trans.id] = Object.keys(self.getOut()).filter((placeId) => {
        return self.getOut()[placeId][trans.id];
      });
    });
    let isFreeChoice = Object.keys(map).every((t1, i) => {
      let t1_inplaces = map[t1];
      return Object.keys(map).every((t2, j) => {
        let t2_inplaces = map[t2];
        return intersection(t1_inplaces, t2_inplaces).length == 0 || t1 === t2;
      });
    });
    return isFreeChoice;
  };

  PetriNetClassifier.prototype.getIn = function () {
    let self = this;
    let res_In = {};
	let transit = self.myNodes.filter((node) => {
        let meta = self.core.getAttribute(self.core.getMetaType(node), "name");
        return meta === "Transition";
      }).map((transition) => {
        return {id: self.core.getPath(transition),node: transition,};
	  });
	let myPlace = self.myNodes.filter((node) => {
        let meta = self.core.getAttribute(self.core.getMetaType(node), "name");
        return meta === "Place";
      }).map((place) => {
        return {id: self.core.getPath(place),node: place,};
      });
    myPlace.map((p) => p.id).forEach((pid, i) => {
        res_In[pid] = {};
        transit.map((t) => t.id).forEach((tid, j) => {
            res_In[pid][tid] = self.getI_O(pid,tid);
          });
      });
    return res_In;
  };

  PetriNetClassifier.prototype.getOut = function () {
    let self = this;
    let res_Out = {};
	let transit = self.myNodes.filter((node) => {
        return self.core.getAttribute(self.core.getMetaType(node), "name") === "Transition";
      }).map((transition) => {
        return {id: self.core.getPath(transition),node: transition,};
	  });
	let myPlace = self.myNodes.filter((node) => {
        return self.core.getAttribute(self.core.getMetaType(node), "name") === "Place";
      }).map((place) => {
        return {id: self.core.getPath(place),node: place,};
      });
    myPlace.map((p) => p.id).forEach((pid, i) => {
        res_Out[pid] = {};
        transit.map((t) => t.id).forEach((tid, j) => {		
            res_Out[pid][tid] = self.getO_I(pid,tid);
          });
      });
    return res_Out;
  };

  return PetriNetClassifier;
});
