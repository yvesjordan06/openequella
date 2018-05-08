module Common.CommonStrings where 

import Data.Tuple (Tuple(..))
import EQUELLA.Environment (prepLangStrings)

commonRawStrings = Tuple "common" {
  action: {
    save: "Save",
    cancel: "Cancel",
    undo: "Undo",
    add: "Add", 
    ok: "OK",
    continue: "Continue"
  }, 
  users : "Users", 
  groups: "Groups", 
  roles: "Roles"
}

commonString = prepLangStrings commonRawStrings
commonAction = commonString.action