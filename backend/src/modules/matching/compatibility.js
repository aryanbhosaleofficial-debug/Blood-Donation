'use strict';
/** Registered potential red-cell donor groups only. Final donor suitability and
 * compatibility are determined by qualified medical professionals. */
const{ValidationError}=require('../../core/errors');const{COMPONENTS}=require('../../core/constants');
const MAP=Object.freeze({'O-':['O-'],'O+':['O-','O+'],'A-':['O-','A-'],'A+':['O-','O+','A-','A+'],'B-':['O-','B-'],'B+':['O-','O+','B-','B+'],'AB-':['O-','A-','B-','AB-'],'AB+':['O-','O+','A-','A+','B-','B+','AB-','AB+']});
function compatibleDonorGroups(component,recipientBloodGroup){if(component!==COMPONENTS.RED_CELLS)throw new ValidationError('Potential donor matching supports red cells only.',{code:'UNSUPPORTED_COMPONENT'});const groups=MAP[recipientBloodGroup];if(!groups)throw new ValidationError('Recipient blood group is invalid.',{code:'INVALID_BLOOD_GROUP'});return[...groups];}
module.exports={compatibleDonorGroups};
