import { EditorElement, EditorElementTypes } from './EditorElement.js'

export class TabBlock extends EditorElement {
    constructor(){
        super(EditorElementTypes.Tab);
    }

    Clone_() {
        return new TabBlock();
    }

    ToJson_(){
        return {};
    }

    Render_($container){
        let $elem = $('<div/>').addClass('tab');
        $container.append($elem);
        this.$wholeView = this.$customizableView = $elem;
    }
}