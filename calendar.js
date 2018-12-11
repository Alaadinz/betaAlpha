'use strict';

document.addEventListener('DOMContentLoaded', function() {
    // TODO: Ajoutez ici du code qui doit s'exécuter au chargement de
    // la page
});

var cal = document.getElementById("calendrier");
var nbHeures = cal.dataset.nbheures;
var nbJours = cal.dataset.nbjours;

function onClick(event) {
    // TODO

    /* La variable t contient l'élément HTML sur lequel le clic a été
       fait. Notez qu'il ne s'agit pas forcément d'une case <td> du
       tableau */
    var t = event.target;

    // Attribut id de l'élément sur lequel le clic a été fait
    var id = t.id;
    var selection = document.getElementById(id);
    if (selection.innerHTML != '1') {
        selection.innerHTML = '1';     
    } else {
        selection.innerHTML = ''; 
    }
}

function onMove(event) {
    // TODO

    var t = event.target;
    var id = t.id;
}

var compacterDisponibilites = function() {
    // TODO

    return '0000000';
};
