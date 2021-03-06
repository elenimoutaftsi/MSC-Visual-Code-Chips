import { Editor } from './Editor/editor.js'
import { Language } from './language.js'
import { assert } from './Utils/Assert.js'

export class CodeChips {

    static Inject(
        $container,
        {
            languageJson,
            themeJson,
            toolboxJson,
            quickReplace
        }
    ){  
        let language = CodeChips.ParseLanguageJson_(languageJson);
        if (!language){
            assert('Parsing the language resulted into an error');    
            return;
        }
        
        let editor = new Editor($container, language, toolboxJson, themeJson);

        if (quickReplace){
            editor.SetQuickReplace(quickReplace);
        }

        return editor;
    }

    static ParseLanguageJson_(languageJson){
        return Language.FromJson(languageJson);
    }
    
}