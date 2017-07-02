(function() {

	window.SOUNDS = new Sounds();

	function Sounds() {

		this.sounds = {
			crash1: new Audio('/assets/sounds/crash1.wav'),
		 	crash2: new Audio('/assets/sounds/crash2.wav'),
			crash3: new Audio('/assets/sounds/crash3.wav'),
			crash4: new Audio('/assets/sounds/crash4.wav'),
			new_leader: new Audio('/assets/sounds/new_leader.wav'),
			new_player: new Audio('/assets/sounds/new_player.wav'),
			new_record: new Audio('/assets/sounds/new_record.wav'),
			powerup: new Audio('/assets/sounds/powerup.wav'),
			powerup2: new Audio('/assets/sounds/powerup2.wav'),
			rick: new Audio('/assets/music/rick.mp3'),
		};
	}
	
   Sounds.prototype.playSound = function(soundName) {
	   	var sound = this.sounds[soundName];
	   	sound.play();
	    return sound;
   };

   Sounds.prototype.playCrash = function() {
   		var crashName = 'crash'+(_.sample(_.range(3))+1);
   		this.playSound(crashName)
   }

})();