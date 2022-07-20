import { assert } from "./Assert.js";

export class KeyboardEventManager {

    static Keys = {
        A: 65, B: 66, C: 67, D: 68, E: 69,
        F: 70, G: 71, H: 72, I: 73, J: 74,
        K: 75, L: 76, M: 77, N: 78, O: 79,
        P: 80, Q: 81, R: 82, S: 83, T: 84, 
        U: 85, V: 86, W: 87, X: 88, Y: 89, Z: 90, 
        LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
        TAB: 9,
        SPACE: 32,
        ENTER: 13,
        DELETE: 46,
        BACKSPACE: 8,
        ALT: 18,
        SHIFT: 16,
        ESC: 27,
        CTRL: 17,
        ZERO: 48, ONE: 49, TWO: 50, THREE: 51, 
        FOUR: 52, FIVE: 53, SIX: 54, SEVEN: 55, 
        EIGHT: 56, NINE: 57,
    };

    keysDown = [];
    handlers = [];

    constructor($element){
        this.$element = $element;
        this.Init_();
    }

    Init_(){
        this.$element.attr('tabindex', '0');
        
        this.$element.on('keyup', (e) => {
            let ecode = e.char || e.charCode || e.which;
            this.keysDown = this.keysDown.filter(code => code !== ecode);
        });

        this.$element.on('keydown', (e) => {
            let code = e.char || e.charCode || e.which;
            this.keysDown.push(code);
            this.HandleKey_(e);
        });

        this.$element.on('focusout', () => {
            this.keysDown = [];
        });
    }

    /* 
        If a keypress is in multiple key combinations that can apply,
        only 1 handler will be executed and that will be the first registered appliable handler 
    */
    HandleKey_(e){
        let key = e.char || e.charCode || e.which;
        let handlers = this.handlers[key];

        if (handlers){
            for (let {keyCombination, eventHandler} of handlers){
                let combinationDown = !keyCombination.map(key => this.IsKeyDown_(key)).includes(false);
                if (combinationDown){
                    eventHandler(e);
                    return true;
                }
            }
        }
        return false;
    }

    IsKeyDown_(key){
        return this.keysDown.includes(key);
    }

    AddEventHandler(keyCombination, eventHandler){
        let handler = {keyCombination, eventHandler};

        for (let key of keyCombination){
            assert(Object.values(KeyboardEventManager.Keys).includes(key), 'Error: Invalid Input Key');
            if (!this.handlers[key])
                this.handlers[key] = [];
            
            this.handlers[key].push(handler);
        }

        return this;
    }

}