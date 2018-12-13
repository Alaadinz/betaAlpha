'use strict';

document.addEventListener('DOMContentLoaded', function() {
});

function onClick(event) {
    /* La variable t contient l'élément HTML sur lequel le clic a été
       fait. Notez qu'il ne s'agit pas forcément d'une case <td> du
       tableau */
    var t = event.target;

    // Attribut id de l'élément sur lequel le clic a été fait
    var id = t.id;
    var selection = document.getElementById(id);

    // verifie si le id est un nb (si oui, c'est une case du tab)
    if (+id.split("-").join("") >= 0) {
        if (selection.innerHTML == '') {
            selection.innerHTML = '&#10003';
        } else {
            selection.innerHTML = '';
        }
    }
}

function onMove(event) {
    var t = event.target;
    var id = t.id;
}

var compacterDisponibilites = function() {
    
    var cal = document.getElementById("calendrier");
    var nbHeures = cal.dataset.nbheures;
    var nbJours = cal.dataset.nbjours;
    
    var resultat = [];
    var selection;

    for (var i = 0; i < nbHeures; i++) {
        for (var j = 0; j < nbJours; j++) {
            selection = document.getElementById(i+'-'+j);
            if (selection.innerHTML == '') {
                resultat.push('0');
            } else {
                resultat.push('1');
            }
        }
    }

    resultat = resultat.join('').split(',').join('');
    return resultat;
};
