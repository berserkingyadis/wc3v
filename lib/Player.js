const utils = require("../helpers/utils"),
      mappings = require("../helpers/mappings");

const { 
	abilityActions,
	abilityFlagNames,
	mapStartPositions,
	specialBuildings
} = mappings;

const Unit = require("./Unit"),
			Hero = require("./Hero"),
			Building = require("./Building"),
      SubGroup = require("./SubGroup"),
      PlayerActions = require("./PlayerActions");

const SelectModes = {
	select: 1,
	deselect: 2
};

const Player = class {
	constructor (id, playerSlot, eventTimer, world) {
		this.id = id;
		this.playerSlot = playerSlot;
		this.teamId = playerSlot.teamId;
		this.race = playerSlot.raceFlag;

		this.eventTimer = eventTimer;
		this.world = world;

		this.units = [];
		this.setupInitialUnits();

		this.removedBuildings = [];

		this.startingPosition = null;
		this.updatingSubgroup = false;
		this.selection = null;
		this.groupSelections = {};

		this.heroSlotCount = 0;

		this.buildMenuOpen = false;
		this.tavernSelected = false;

		this.itemMoveSelected = false;
		this.itemMoveObject = null;

		this.possibleRegisterItem = null;
		this.possibleSelectList = [];

		this.knownObjectIds = {
			'worker': null,
			'townhall': null
		};

		this.debugRegister = [];

		this.debugCount = 0;
	}

	printUnits () {
		console.logger("player units for id: ", this.id);

		const sortedUnits = this.units.sort((a, b) => {
			const aName = a.displayName.toUpperCase();
			const bName = b.displayName.toUpperCase();

			if (aName < bName) {
				return -1;
			}

			if (aName > bName) {
				return 1;
			}

			return 0;
		});

		console.logger(sortedUnits.map(unit => {
			return `${unit.displayName} - [${unit.objectId1}, ${unit.objectId2}] ${unit.itemId1}, ${unit.itemId2}`;
		}));
	}

	printAllGroups () {
		console.logger("all groups: ");
		const self = this;

		Object.keys(this.groupSelections).forEach(key => {
			let group = this.groupSelections[key];

			console.logger(key, "units: ", group.units.map(gunit => {
				const playerUnit = self.findUnit(gunit.itemId1, gunit.itemId2);

				const displayName = playerUnit ? playerUnit.displayName : "Unregistered";

				return gunit.itemId1 + "," + gunit.itemId2 + " - " + displayName;
			}));

			this.checkValidGroup(group.units);
		});
	}

	printSelectionUnits () {
		const self = this;
		console.logger("current selection units: ", this.selection.units.map(gunit => {
			const playerUnit = self.findUnit(gunit.itemId1, gunit.itemId2);

			if (!playerUnit) {
				return `${gunit.itemId1}, ${gunit.itemId2} - Unregistered`;
			}

			const {
				itemId1,
				itemId2,
				objectId1,
				objectId2,
				displayName
			} = playerUnit;

			return `${itemId1}, ${itemId2} [${objectId1}, ${objectId2}] - ${displayName}`;
		}));

		this.checkValidGroup(this.selection.units);
	}

	checkValidGroup (group) {
		const self = this;
		if (!group.length) {
			return true;
		}

		let firstGroupItem = group[0];
		let firstGroupUnit = this.findUnit(firstGroupItem.itemId1, firstGroupItem.itemId2);

		if (!firstGroupUnit || !firstGroupUnit.isRegistered) {
			console.logger("warning: cant check group validity with unknown first unit.");
			return true;
		}

		const groupType = (firstGroupUnit.isBuilding && !firstGroupUnit.isUprooted) ? 0 : 1;
		for (let i = 0; i < group.length; i++) {
			const { itemId1, itemId2 } = group[i];

			let groupUnit = self.findUnit(itemId1, itemId2);

			if (groupUnit) {
				const checkType = (groupUnit.isBuilding && !groupUnit.isUprooted) ? 0 : 1;

				if (checkType !== groupType) {
					console.logger("bad group found.");

					//throw new Error("here 6");
				}
			}
		}
	}

	setupInitialUnits () {
		let townHallId, workerCount;

		console.logger("setup player race: ", this.race);

		switch (this.race) {
			case 'O':
				townHallId = 'ogre';
				workerCount = 5;
			break;
			case 'H':
				townHallId = 'htow';
				workerCount = 5;
			break;
			case 'E':
				townHallId = 'etol';
				workerCount = 5;
			break;
			case 'U':
				townHallId = 'unpl';
				workerCount = 3;
			break;
		};

		// add the town hall
		const townhall = new Building(
			this.eventTimer,
			null,
			null,
			townHallId,
			true
		);

		this.addPlayerBuilding(townhall);

		// add the workers
		for (let i = 0; i < workerCount; i++) {
			const worker = new Unit(
				this.eventTimer,
				null,
				null,
				mappings.workerForRace[this.race],
				true
			);

			this.addPlayerUnit(worker);
		}

		// workers + 1 town hall
		this.unregisteredUnitCount = (workerCount + 1);
	}

	isPlayersRace (itemId) {
		let firstItemIdLetter = itemId[0].toUpperCase();

		return firstItemIdLetter === this.race;
	}

	findUnit (itemId1, itemId2) {
		return this.units.find(unit => {
			return utils.isEqualItemId(unit.itemId1, itemId1) && 
			       utils.isEqualItemId(unit.itemId2, unit.itemId2);
		});
	}

	findUnitByObjectId (objectId1, objectId2) {
		return this.units.find(unit => {
			return unit.objectId1 === objectId1 &&
			       unit.objectId2 === objectId2;
		});
	}

	findUnitByItemId (fixedItemId) {
		return this.units.find(unit => {
			return unit.itemId === fixedItemId;
		});
	}

	findUnregisteredUnit () {
		return this.units.find(unit => {
			return unit.objectId1 === null;
		});
	}

	findUnregisteredBuilding () {
		return this.units.find(unit => {
			return unit.isBuilding && unit.itemId1 == null;
		});
	}

	findUnregisteredUnitByItemId (itemId) {
		return this.units.find(unit => {
			return unit.itemId === itemId &&
			       (unit.itemId1 === null || unit.objectId1 === null);
		});
	}

	findUnregisteredUnitByItemIds (itemId1, itemId2) {
		return this.units.find(unit => {
			return utils.isEqualItemId(unit.itemId1, itemId1) && 
			       utils.isEqualItemId(unit.itemId2, unit.itemId2) &&
			       unit.objectId1 === null;
		});
	}

	findSwapUnitByItemId (itemId) {
		return null;
	}

	filterUnitByItemId (itemId) {
		return this.units.filter(unit => {
			return unit.itemId === itemId;
		});
	}

	addPlayerUnit (unit) {
		let heroFilter = this.units.filter(pUnit => {
			return pUnit.itemId === "Udea";
		});

		if (heroFilter.length && unit.itemId === "Udea") {
			console.logger("detected hero add");
			console.logger(unit);
		}

		console.logger(`adding unit ${unit.displayName}`);
		this.units.push(unit);

		this.printUnits();
	}

	addPlayerBuilding (unit) {
		console.logger("adding player building: ", unit.itemId, unit.displayName);

		let existingBuilding = this.units.find(playerUnit => {
			return playerUnit.isBuilding &&						 
			       playerUnit.currentX === unit.currentX &&
			       playerUnit.currentY === unit.currentY;
		});

		if (!Building.isTavern(unit.itemId) && existingBuilding) {
			console.logger("!! found existing building already.");
			console.logger(existingBuilding.displayName);

		}

		console.logger("adding building at: ", unit.currentX, unit.currentY, unit.displayName);
		this.units.push(unit);
	}

	removePlayerBuilding (unit) {
		let isRegistered = false;

		const { 
			currentX,
			currentY
		} = unit;

		console.logger("Trying to remove building: ", unit.displayName);
		let removeIndex = this.units.findIndex(removeUnit => {
			return removeUnit.currentX === currentX &&
						 removeUnit.currentY === currentY;
		});

		const removedBuilding = this.units[removeIndex];
		if (removedBuilding) {
			console.logger("removing building. index: ", removeIndex);
			console.logger("units before: ", this.units.map(unit => unit.displayName));
			this.removedBuildings.push(removedBuilding);
			this.units.splice(removeIndex, 1);
			console.logger("units after: ", this.units.map(unit => unit.displayName));
		}
	}

	getSelectionUnits () {
		const self = this;
		if (!this.selection) {
			console.logger("no selection, return empty");
			return [];
		}

		return this.selection.units.reduce((acc, unitItem) => {
			const { itemId1, itemId2 } = unitItem;
			const unit = self.findUnit(itemId1, itemId2);

			console.logger("looking for unit: ", itemId1, itemId2);
			if (unit) {
				console.logger("found unit", unit.displayName);
				acc.push(unit);
			} else {
				console.logger("not found.");
			}

			return acc;
		}, []);
	}

	toggleUpdateSubgroup (action) {
		// auto-gen war3 message was triggered
		this.updatingSubgroup = true;
	}

	assignKnownUnits () {
		let self = this;
		let knownObjectIds = this.knownObjectIds;

		const shouldCheckAssignments = Object.keys(knownObjectIds).some(key => {
			return knownObjectIds[key] === null;
		});

		if (!shouldCheckAssignments) {
			return;
		}

		this.units.forEach(unit => {
			if (!unit.isSpawnedAtStart || unit.objectId1 === null) {
				return;
			}

			if (!knownObjectIds.worker && unit.meta.worker) {
				knownObjectIds.worker = unit.objectId1;
			} else if (!knownObjectIds.townhall && unit.isBuilding) {
				knownObjectIds.townhall = unit.objectId1;
			}
		});
	}

	registerKnownItem (unit, item) {

	}

	guessUnitType (objectId) {
		const knownObjectIds = this.knownObjectIds;
		const threshold = 6;

		let bestGuess = Object.keys(knownObjectIds).find(key => {
			const knownId = knownObjectIds[key];
			if (knownId === null) {
				return false;
			}

			return Math.abs(knownId - objectId) <= threshold;
		});

		return bestGuess || null;
	}

	setHeroSlot (heroUnit) {
		this.heroSlotCount++;
		
		const nextHeroSlot = this.heroSlotCount;
		heroUnit.heroSlot = nextHeroSlot;

		if (nextHeroSlot === 1) {
			console.logger(this.id, "Gave first hero a TP item.");
			heroUnit.giveItem('stwp');
		}

		return heroUnit;
	}

	//
	// Called during `selectSubgroup` when unregistered units
	// are known to exist.  The `itemId` is only known for
	// one unit - the first in the selection group.  So
	// we limit the amount of registerable units to 1
	//

	assignPossibleSelectGroup (itemId) {
		let self = this;
		const selectionUnits = this.selection.units;

		console.logger("assign possible sel group itemId: ", itemId);

		return selectionUnits.reduce((registeredUnitsAcc, selectionUnit) => {
			self.possibleSelectList = self.possibleSelectList.filter(selectItem => {
				const { itemId1, itemId2 } = selectItem;

				const foundSelectionUnit = (
					utils.isEqualItemId(selectionUnit.itemId1, itemId1) &&
					utils.isEqualItemId(selectionUnit.itemId2, itemId2)
				);

				if (foundSelectionUnit) {
					let foundPlayerUnit = self.units.find(playerUnit => {
						return playerUnit.itemId === itemId && // same unit as selection
						       playerUnit.itemId1 === null;
					});

					if (foundPlayerUnit) {
						console.logger("found unit to register", itemId1, itemId2, foundPlayerUnit.displayName);
						foundPlayerUnit.registerItemIds(itemId1, itemId2);
						self.unregisteredUnitCount--;

						registeredUnitsAcc.push(foundPlayerUnit);
						self.debugRegister.push(foundPlayerUnit.displayName);

						return false;
					}
				}

				return true;
			});

			return registeredUnitsAcc;
		}, []);
	}

	checkItemAssignments (hero, checkSlot, objectId1, objectId2) {
		const heroItemId = hero.itemId;
		const currentItem = hero.items[checkSlot];

		console.logger("Checking item assignments: ", hero.displayName, checkSlot);

		let heroes = this.units.filter(unit => {
			return unit.meta.hero;
		});

		let swapItem;
		heroes.forEach(hero => {
			const heroItems = hero.getItemList();

			heroItems.forEach(heroItem => {
				const { item, slot } = heroItem;

				if (hero.itemId !== heroItemId ||
				   (hero.itemId === heroItemId && slot !== checkSlot)) {
					console.logger("Checking other item: ", item);

					if (item.objectId1 === objectId1 &&
						  item.objectId2 === objectId2) {
						swapItem = {
							hero: hero,
							slot: slot,
							item: item
						};
					}
				}
			});
		});

		if (swapItem) {
			const { hero, item, slot } = swapItem;
			console.logger(this.id, "Found an item to swap: ", hero.displayName, slot, item.displayName);
		}

	}

	selectSubgroup (action) {
		const self = this;
		const { itemId, objectId1, objectId2 } = action;
		const firstGroupItem = this.selection.units[0];

		console.logger("raw sel: ", this.selection.units);

		if (!firstGroupItem) {
			console.error("Empty selection during selectSubgroup.");
			this.selection.printGroup();
		}

		const {itemId1, itemId2} = firstGroupItem;
		const fixedItemId = utils.fixItemId(itemId);

		if (Building.isTavern(fixedItemId)) {
			this.tavernSelected = true;
		} else if (this.tavernSelected) {
			this.tavernSelected = false;
		}

		if (this.race === "R") {
			console.logger("random race detected, changing to what we see.");
			this.race = fixedItemId.substring(0, 1).toUpperCase();

			console.logger("new race: ", this.race);

			// redo the initial setup
			this.setupInitialUnits();
		}

		if (!this.isPlayersRace(fixedItemId) && !this.findUnitByItemId(fixedItemId) && !this.tavernSelected) {
			console.logger("Early exit. wrong race.");

			const badUnitInfo = mappings.getUnitInfo(fixedItemId);
			console.logger("player race: ", this.race, "bad unit: ", badUnitInfo);

			if (this.tavernSelected) {
				console.logger("tavern is sel");
			}

			return;
		}

		console.logger("assign possible select units");
		let newlyRegisteredUnits = this.assignPossibleSelectGroup(fixedItemId);
		
		console.logger("new reg unit count: ", newlyRegisteredUnits.length);
		console.logger("firstGroupItem: ", firstGroupItem);

		console.logger("Looking for unit in group: ", itemId1, itemId2);
		let firstGroupUnit = this.findUnit(itemId1, itemId2);

		if (firstGroupUnit) {
			console.logger("found first unit in group");
			firstGroupUnit.printUnit();
		} else {
			console.logger("no first group unit found");
		}

		// could not find registered unit by itemId1-2
		// we didn't register any new units from possible select group
		if (!firstGroupUnit && !newlyRegisteredUnits.length) {
			PlayerActions.selectSubGroupWithNoKnowns(
				this,
				fixedItemId,
				itemId1, 
				itemId2,
				objectId1,
				objectId2
			);
		} else {
			console.logger("selectSubgroup 4");

			const notSameFirstUnitCheck = firstGroupUnit && fixedItemId !== firstGroupUnit.itemId;

			const objectMismatchCheck = firstGroupUnit && firstGroupUnit.objectId1 &&
				(firstGroupUnit.objectId1 !== objectId1 || firstGroupUnit.objectId2 !== objectId2) &&
				(firstGroupUnit.objectId1 !== null);

			const objectInGroup = !firstGroupUnit && this.selection.units.find(sUnit => {
				return self.findUnit(sUnit.itemId1, sUnit.itemId2);
			});

			const unitHasEvolution = firstGroupUnit && firstGroupUnit.evolution && 
				firstGroupUnit.evolution.itemId === fixedItemId;

			if (notSameFirstUnitCheck) {
				console.logger("not same first unit check hit");
			}

			if (objectMismatchCheck) {
				console.logger("object id misamtch hit", objectId1, objectId2, firstGroupUnit.objectId1, firstGroupUnit.objectId2);
			}

			if (objectInGroup) {
				console.logger("object in group check hit");
			}

			if (unitHasEvolution) {
				console.logger("Unit has an evolution, ignore mismatch itemId since it matched: ", firstGroupUnit.evolution);
			}

			if (!unitHasEvolution && (notSameFirstUnitCheck || objectMismatchCheck || objectInGroup)) {
				const unitInfo = mappings.getUnitInfo(fixedItemId);
				console.logger("Tab-switch from:", firstGroupUnit && firstGroupUnit.displayName, "to: ", unitInfo.displayName);

				PlayerActions.registerTabSwitch(
					this,
					firstGroupUnit,
					newlyRegisteredUnits,
					fixedItemId,
					itemId1, // the itemId1-2 of the first unit in the selection
					itemId2,
					objectId1,
					objectId2
				);

				return;
			}

			PlayerActions.registerSubGroupFocusUnit(
				this,
				firstGroupUnit,
				fixedItemId,
				itemId1, 
				itemId2,
				objectId1,
				objectId2
			);
				
		}
	}

	changeSelection (action) {
		const self = this;
		const subActions = action.actions;
    const selectMode = action.selectMode;
    const numberUnits = action.numberUnits;

    let hasUnregisteredUnitFlag = false;
    let subGroup = new SubGroup(numberUnits, subActions);

    if (selectMode === SelectModes.deselect) {
    	// de-selected unit
    	this.selection.deselect(subGroup);

    	const newSelectUnits = this.getSelectionUnits();

    	console.logger("new selection: ", newSelectUnits.map(nunit => nunit.displayName));
    	console.logger("new raw sel: ", this.selection.units);

    	return;
    }

  	// register first-time selected units
  	subActions.forEach(subAction => {
  		const {itemId1, itemId2} = subAction;
  		let unit = self.findUnit(itemId1, itemId2);
  		
  		if (unit) {
  			console.logger("set unit alive: ", unit.displayName, itemId1, itemId1);
  			unit.setAliveFlags();
  			return;
  		}

  		console.logger("didnt find unit yet: ", itemId1, itemId2);
		  
		  // we can't know for sure
			// that this unit needs to be made or registered yet
			self.possibleSelectList.push({
				itemId1: itemId1,
				itemId2: itemId2
			});

			hasUnregisteredUnitFlag = true;
  	});

  	if (this.selection === null) {
  		// no sub-group yet.  assign our newly selected one
  		this.selection = subGroup;	
  	} else {
  		// merge our selected sub groups
  		this.selection.mergeGroups(subGroup);

  		this.printSelectionUnits();
  	}

  	if (hasUnregisteredUnitFlag) {
  		this.selection.hasUnregisteredUnit = true;
  	}
	}

	useAbilityNoTarget (action) {
		const isItemArray = Array.isArray(action.itemId);
		const itemId = isItemArray ?
			action.itemId : utils.fixItemId(action.itemId);
		const {
			abilityFlags,
			unknownA,
			unknownB
		} = action;
		
		const unitInfo = mappings.getUnitInfo(itemId);
		let selectedUnits = this.getSelectionUnits();

		if (!selectedUnits.length) {
			console.logger("no selected unit for ability with no target...", unitInfo);
			console.logger("raw sel: ", this.selection.units);

			if (unitInfo.isBuilding) {
				console.logger("unit is a building, register it");

				const firstSelectionItem = this.selection.units[0];

				console.logger("reg item as building: ", firstSelectionItem);

				let maybeBuilding = this.findUnregisteredUnitByItemIds(
					firstSelectionItem.itemId1, 
					firstSelectionItem.itemId2
				);

				if (maybeBuilding) {
					console.logger("existing maybe building: ", maybeBuilding);
				} else {
					console.logger("no existing building");
				}
			} else {
				console.logger("not building? ", unitInfo);
			}

			this.printSelectionUnits();
		}

		if (selectedUnits.length) {
			let firstUnit = selectedUnits[0];

			console.logger("has sel unit: ", firstUnit.displayName);

			if (firstUnit.meta.hero) {
				if (isItemArray) {
					Hero.doAbilityNoTargetItemArray(
						this,
						firstUnit,
						itemId,
						abilityFlags,
						unknownA,
						unknownB
					);
				} else {

					if (itemId === "AUdc") {
						console.logger("jeff about to coil");
						this.printSelectionUnits();

					}

					Hero.doAbilityNoTargetItemId(
						this,
						firstUnit,
						itemId,
						abilityFlags,
						unknownA,
						unknownB
					);
				}
			}

			if (firstUnit.isBuilding || unitInfo.isItem) {
				if (isItemArray) {
					console.logger("building item array ability");
					Building.doAbilityNoTargetItemArray(
						this,
						firstUnit,
						itemId,
						abilityFlags,
						unknownA,
						unknownB
					);
				} else {
					console.logger("building itemid ability");
					Building.doAbilityNoTargetItemId(
						this,
						firstUnit,
						itemId,
						abilityFlags,
						unknownA,
						unknownB
					);	
				}
			}

			return;
		}
		
		switch (abilityFlags) {
			// learn skill
			case abilityFlagNames.Summon:
				if (this.tavernSelected) {
					let newTavernHero = new Unit(this.eventTimer, null, null, itemId, false);
					this.setHeroSlot(newTavernHero);

					console.logger(this.id, "Creating tavern hero: ", unitInfo.displayName);
					this.addPlayerUnit(newTavernHero);
					this.unregisteredUnitCount++;
				}
			break;

			default:
				console.logger("no ability found");
			break;
		}
	} 

	useAbilityWithTargetAndObjectId (action) {
		const isItemArray = Array.isArray(action.itemId);
		const { 
			targetX, 
			targetY,
			objectId1,
			objectId2
		} = action;

		let units = this.getSelectionUnits();
		let firstUnit = units[0];

		if (!firstUnit) {
			
			// todo: fix this?
			//console.error("Trying to use ability without registered selected unit.");
			//this.selection.printGroup();

			console.logger("error? no first unit in UseAbilityWithTargetAndObjectId");
			
			console.logger("raw: ", this.selection.units);
			return;
		}

		const abilityActionName = utils.findItemIdForObject(action.itemId, abilityActions);
		switch (abilityActionName) {
			case 'EatTree':
				console.logger("NE Building eating a tree");
			break;
			case 'UnsummonBuilding':
				console.logger("Detected unsummon");
				let possibleBuilding = utils.closestToPoint(targetX, targetY, this.units, (unit) => {
					return unit.isBuilding;
				});

				if (possibleBuilding) {
					console.logger("Found unsummon building: ", possibleBuilding.displayName);

					this.removePlayerBuilding(possibleBuilding);
				}
			break;
			case 'CastSkillTarget':
				console.logger("Casting target skill at point.");
				console.logger("Unit casting: ", firstUnit.displayName);

				if (firstUnit.meta.hero) {
					console.logger("Hero CastSkillTarget spell.");
					let skill = firstUnit.getSkillForType("pointTarget");

					if (!skill) {
						console.logger("Couldnt find pointTarget skill for unit: ", firstUnit);
						return;
					}

					console.logger("Casting point target skill: ", skill);
				}
			break;
			case 'CastSkillObject':
				console.logger("casting skill on object target.");
				console.logger("Unit casting: ", firstUnit.displayName);

				if (firstUnit.meta.hero) {
					console.logger("Hero CastSkillObject spell.");
					let skill = firstUnit.getSkillForType("objectTarget");

					if (!skill) {
						console.logger("Couldnt find objectTarget skill for unit: ", firstUnit);
						return;
					}
					
					console.logger("Casting object target skill: ", skill);
				}
			break;
			case 'MoveCommand':
				// todo: move without attacking eventually 
				//       once attacking is a thing

				units.forEach(unit => {
					unit.moveTo(targetX, targetY);
				});
			break;
			case 'AttackCommand':
				// todo: move with attacking eventually 
				//       once attacking is a thing

				units.forEach(unit => {
					unit.moveTo(targetX, targetY);
				});
			break;
			case 'RightClick':
				if (firstUnit && firstUnit.isBuilding) {

					console.logger("Building.doAbilityRightClickWithTargetAndObjectId")
					Building.doAbilityRightClickWithTargetAndObjectId(
						this,
						firstUnit,
						objectId1,
						objectId2,
						targetX,
						targetY
					);
					
				} else if (firstUnit && firstUnit.meta.hero) {


					if (objectId1 === -1 && objectId2 === -1) {
						// TODO: rally point and ability on ground here
						console.logger("moving hero fronted unit group from ground right click");

						units.forEach(unit => {
							unit.moveTo(targetX, targetY);
						});

						return;
					}

					Hero.doAbilityRightClickWithTargetAndObjectId(
						this,
						firstUnit,
						objectId1,
						objectId2,
						targetX,
						targetY
					);

				} else if (firstUnit && firstUnit.isUnit) {
					units.forEach(unit => {
						unit.moveTo(targetX, targetY);
					});
				} else {
					console.logger(this.id, "At bottom of right click.", firstUnit);
				}
				
			break;
			case 'HeroMoveItem1':
			case 'HeroMoveItem2':
			case 'HeroMoveItem3':
			case 'HeroMoveItem4':
			case 'HeroMoveItem5':
			case 'HeroMoveItem6':
				const itemSlot = abilityActionName.substring(abilityActionName.length - 1);
				const heroItems = firstUnit.getItemList();
				const itemCount = heroItems.length;
				console.logger(this.id, "Hero moving item: ", firstUnit.displayName);

				const knownItem = heroItems.find(heroItem => {
					const item = heroItem.item;

					return (item.objectId1 === objectId1 &&
								  item.objectId2 === objectId2) ||
								 (item.knownItemX === targetX &&
								  item.knownItemY === targetY);
				});

				if (itemCount === 1) {
					const slotItem = heroItems[0];

					slotItem.item.registerObjectIds(objectId1, objectId2);
					slotItem.item.registerKnownItem(targetX, targetY);
					this.world.clearKnownItem(objectId1, objectId2);

					firstUnit.items[slotItem.slot] = null;
					firstUnit.items[itemSlot] = slotItem.item;

					console.logger(this.id, `${firstUnit.displayName} moved only item ${slotItem.item.displayName} to slot ${itemSlot}`);
				} else {
					let destinationItem = firstUnit.items[itemSlot];

					if (destinationItem) {
						// we have an item to swap places with
						// try to figure out what that item is

						console.logger(this.id, `${firstUnit.displayName} moving item ${destinationItem.displayName} in slot ${itemSlot}`);

						let swapCandidates = heroItems.filter(heroItem => {
							return heroItem.slot !== itemSlot;
						});

						if (swapCandidates.length === 1) {
							const swapSlot = swapCandidates[0];
							const swapItem = swapSlot.item;

							console.logger(this.id, "Swapping with only other item: ", swapItem.displayName);

							swapItem.registerObjectIds(objectId1, objectId2);
							swapItem.registerKnownItem(targetX, targetY);
							this.world.clearKnownItem(objectId1, objectId2);

							firstUnit.items[swapSlot.slot] = destinationItem;
							firstUnit.items[itemSlot] = swapItem;

						}
					} else {
						console.logger(this.id, "Hero has nothing to swap item with, just put it in place. Slot moved: ", itemSlot);

						if (knownItem) {
							console.logger(this.id, "Found known swap item: ", knownItem.item.displayName);

							console.logger("known slot: ", knownItem.slot, "Moving slot: ", itemSlot);

							firstUnit.items[knownItem.slot] = null;
							firstUnit.items[itemSlot] = knownItem.item;
							this.world.clearKnownItem(objectId1, objectId2);

							console.logger(this.id, `Put item ${knownItem.item.displayName} into slot ${itemSlot}`);							
						} else {
							console.logger(this.id, "Not a known item.");

							let unregisteredSwapItem = heroItems.find(heroItem => {
								const item = heroItem.item;

								return heroItem.slot !== itemSlot &&
											 item.knownItemX === targetX &&
											 item.knownItemY === targetY;
							});

							console.logger(this.id, "Looking for item registered with action objectId");

							if (unregisteredSwapItem) {
								console.logger(this.id, "Found potential unregistered item to assign swap to: ", unregisteredSwapItem.item.displayName);	

								unregisteredSwapItem.item.registerObjectIds(objectId1, objectId2);
								unregisteredSwapItem.item.registerKnownItem(targetX, targetY);
								this.world.clearKnownItem(objectId1, objectId2);

								firstUnit.items[unregisteredSwapItem.slot] = null;
								firstUnit.items[itemSlot] = unregisteredSwapItem.item;

								console.logger(this.id, `Put item ${unregisteredSwapItem.item.displayName} into slot ${itemSlot}`);							
							} else {
								console.logger(this.id, "Unable to find unregistered item?");
								

								let unregisteredItems = heroItems.filter(heroItem => {
									return heroItem.item.objectId1 === null ||
									       heroItem.item.knownItemX === null;
								});

								if (unregisteredItems.length === 1) {
									const swapSlot = unregisteredItems[0];
									const swapItem = swapSlot.item;

									swapItem.registerObjectIds(objectId1, objectId2);
									swapItem.registerKnownItem(targetX, targetY);
									this.world.clearKnownItem(objectId1, objectId2);

									firstUnit.items[swapSlot.slot] = null;
									firstUnit.items[itemSlot] = swapItem;

									console.logger(this.id, `Put item ${swapItem.displayName} into slot ${itemSlot}`);							
								} else {
									console.logger("%% more than one unregistered item?");
								}

							}
						}

					}

				}

			break;

			default:
				console.logger("unknown action");
			break;
		}
	}

	useAbilityWithTarget (action) {
		const { targetX, targetY, itemId } = action;
		const isItemArray = Array.isArray(action.itemId);
		const fixedItemId = utils.fixItemId(itemId);

		const selectionUnits = this.getSelectionUnits();
		let firstUnit = selectionUnits[0];

		const unitInfo = mappings.getUnitInfo(fixedItemId);

		console.logger("ability unitInfo: ", unitInfo);

		if (isItemArray) {
			console.logger("Use ability with target item array.");

			const abilityActionName = utils.findItemIdForObject(itemId, abilityActions);
			console.logger("maybe action name: ", abilityActionName);

			switch (abilityActionName) {
				case 'NERoot':
					console.logger("building rooted.");
				break;
				default:
					console.logger("unable to find unit ability");
				break;
			}

			return;
		} else {
			console.logger("ability not item arraay");

			console.logger("menu open: ", (this.buildMenuOpen) ? "is open" : "is closed");
			console.logger("first unit is: ", firstUnit && firstUnit.displayName);
			console.logger("selection is: ", selectionUnits.map(sunit => sunit.displayName));
			console.logger("raw selection: ", this.selection);
			console.logger("raw selection: ", this.selection.units);

			if (!firstUnit || this.selection.hasUnregisteredUnit) {
				console.logger("Unregistered unit used ability. Check if worker building.");
				const possibleBuilding = mappings.getUnitInfo(fixedItemId);

				if (this.buildMenuOpen && possibleBuilding.isBuilding) {
					console.logger("Found a possible building: ", possibleBuilding.displayName);

					let workerUnits = this.filterUnitByItemId(mappings.workerForRace[this.race]);

					console.logger("worker units: ", workerUnits.map(wunit => {
						return `itemId1: ${wunit.itemId1} id2: ${wunit.itemId2}`;
					}));
				}
			}

			const workerInGroup = selectionUnits.find(sunit => {
				return sunit.meta.worker;
			});

			if (workerInGroup) {
				console.logger("has worker in group");
			}

			if (workerInGroup) {
				const startingPosition = {
					x: targetX,
					y: targetY
				};

				let building = new Building(this.eventTimer, null, null, fixedItemId, false);
				building.registerUnit(fixedItemId, null, null);
				building.currentX = targetX;
				building.currentY = targetY;

				const playerInstance = this;
				console.logger("moving unit to build: ", building.displayName);
				firstUnit.moveToBuild(building, (eventFinished) => {
					if (!eventFinished) {
						
						const distanceLeft = utils.distance(
							building.currentX, building.currentY,
							firstUnit.currentX, firstUnit.currentY
						);

						console.logger("unit dist from building spot: ", distanceLeft);

						// if (distanceLeft > 1000) {
						// 	console.logger("building move event was cancelled before build. builder: ", firstUnit.displayName);
						// 	console.logger("stopped building: ", building.displayName);

						// 	return;
						// }
					}

					console.logger("unit finished moving to building, now building: ", building.displayName);

					playerInstance.addPlayerBuilding(building);
					building.startConstruction();
				});

				// toggle OFF the build menu since we just used it in an action
				console.logger(this.id, "*** setting build menu CLOSED");
				this.buildMenuOpen = false;

				return;
			}

			throw new Error("here 3");
		}
	}

	chooseBuilding (action) {
		console.logger(this.id, "*** setting build menu OPEN");
		this.buildMenuOpen = true;
	}

	assignGroupHotkey (action) {
		const { 
			groupNumber, 
			numberUnits,
			actions
		} = action;

		console.logger("setting group: ", groupNumber);

		console.logger("before set: ", this.selection.units);

		for (let i = 0; i < actions.length; i++) {
			console.logger("action: ", actions[i]);
		}
 
		this.groupSelections[groupNumber] = new SubGroup(numberUnits, actions);
		this.selection = new SubGroup(numberUnits, actions);

		console.logger("selection units: ", this.selection.units);

		this.printAllGroups();
	}

	selectGroupHotkey (action) {
		const { groupNumber } = action;

		console.logger("selecting group: ", groupNumber);
		if (this.groupSelections[groupNumber]) {
			// todo: add group deselectAll
			const { 
				numberUnits, 
				units,
				hasUnregisteredUnit
			} = this.groupSelections[groupNumber];

			let groupCopy = new SubGroup(numberUnits, units, hasUnregisteredUnit);
			this.selection = groupCopy;

			if (this.selection.numberUnits === 0) {
				console.error("%% Error group: ", this.selection);
				throw new Error("Selectected a group hotkey with zero units.");
			}

			console.logger("selected group: ", groupNumber, groupCopy.units);

			this.printAllGroups();
		} else {
			console.error("selected group that didnt exist?");
		}
		
	}

	giveOrDropItem (action ) {
		console.logger("=========================== %%%%%% giveOrDropItem: ", action);
		
		const {
			abilityFlags,
			itemId,
			targetX,
			targetY,
			objectId1,
			objectId2,
			itemObjectId1,
			itemObjectId2
		} = action;

		let selection = this.getSelectionUnits();
		let firstUnit = selection[0];

		if (firstUnit) {
			console.logger(this.id, "Unit giveOrDropItem");

			const heroItems = firstUnit.getItemList();
			const knownItem = heroItems.find(heroItem => {
				const item = heroItem.item;
				return item.objectId1 === itemObjectId1 &&
							 item.objectId2 === itemObjectId2;
			});

			if (objectId1 === -1 && objectId2 === -1) {
				console.logger("Gave item to ground!");

				if (knownItem) { 
					console.logger("put known item on ground.");
					this.world.droppedItems.push(knownItem.item);
					firstUnit.items[knownItem.slot] = null;
					firstUnit.droppedItems.push(knownItem);
				} else {
					console.logger("Need to find potential item to put down.");
					let potentialItem = heroItems.find(heroItem => {
						const item = heroItem.item;
						return item.objectId1 === null;
					});

					if (potentialItem) {
						console.logger("Dropping potential item: ", potentialItem.item.displayName);

						// todo: track maybeSwapItem here
						potentialItem.item.registerObjectIds(itemObjectId1, itemObjectId2);
						firstUnit.items[potentialItem.slot] = null;
						this.world.droppedItems.push(potentialItem.item);

						firstUnit.droppedItems.push(potentialItem);

						console.logger(this.id, "Dropped items: ", this.world.droppedItems.length);
					} else {
						console.error("No potential items to drop.");
					}
				}

			} else {
				const targetHero = this.findUnitByObjectId(objectId1, objectId2);

				if (targetHero) {
					if (knownItem) {
						firstUnit.items[knownItem.slot] = null;
						firstUnit.droppedItems.push(knownItem);
						targetHero.tradeItem(knownItem.item);

						console.logger(this.id, `Hero ${firstUnit.displayName} gave known item to ${targetHero.displayName}`);	
						
					} else {
						// unkown item being traded
						const unknownWorldUnit = this.world.findUnknownObject(objectId1, objectId2);
						const potentialItem = heroItems.find(heroItem => {
							return heroItem.item.objectId1 === null;
						});

						if (potentialItem) {
							potentialItem.item.registerObjectIds(itemObjectId1, itemObjectId2);

							firstUnit.droppedItems.push(potentialItem);
							firstUnit.items[potentialItem.slot] = null;
							targetHero.tradeItem(potentialItem.item);

							console.logger(this.id, `Hero ${firstUnit.displayName} gave unknown item ${potentialItem.item.displayName} to ${targetHero.displayName}`);	
						} else {
							console.logger("Trading hero: ", firstUnit.displayName, "Target: ", targetHero.displayName);
							
							let unknownObject = this.world.findUnknownObject(itemObjectId1, itemObjectId2);
							if (unknownObject) {
								console.logger(this.id, "Found a world item to register.");
								unknownObject.meta.isItem = true;
								targetHero.tradeItem(unknownObject);

								this.world.clearKnownItem(itemObjectId1, itemObjectId2);
							} else {

								let newUnknownItem = new Unit(this.eventTimer, null, null, null, false);
								newUnknownItem.registerObjectIds(itemObjectId1, itemObjectId2);
								newUnknownItem.meta.isItem = true;

								console.logger(this.id, "Gave hero item but had to make new unknown item.");
								targetHero.tradeItem(newUnknownItem);
							}
						}
					}
				} else {
					// can't find hero that is getting item
				}
			}
		}

	}

	useAbilityTwoTargets (action) {
		const { itemId2 } = action;
		const fixedItemId2 = utils.fixItemId(itemId2);

		const unitInfo = mappings.getUnitInfo(fixedItemId2);

		console.logger("itemId2 info: ", unitInfo);
	}
};

module.exports = Player;