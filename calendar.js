'use strict';

document.addEventListener('DOMContentLoaded', function() {
 //???
});

var cal = document.getElementById("calendrier");
var nbHeures = cal.dataset.nbheures;
var nbJours = cal.dataset.nbjours;

var dispos = Array(+nbHeures).fill('0').map(function(x) {
             return Array(+nbJours).fill('0'); });

function onClick(event) {

    /* La variable t contient l'élément HTML sur lequel le clic a été
       fait. Notez qu'il ne s'agit pas forcément d'une case <td> du
       tableau */
    var t = event.target;

    // Attribut id de l'élément sur lequel le clic a été fait
    var id = t.id;
    var idRows = +id.split('-')[0];
    var idCols = +id.split('-')[1];
    var selection = document.getElementById(id);
    if (selection.innerHTML == '') {
        selection.innerHTML = '&#10003';
        dispos[idRows][idCols] = '1';
    } else {
        selection.innerHTML = '';
        dispos[idRows][idCols] = '0';
    }
}

function onMove(event) {
    // TODO

    var t = event.target;
    var id = t.id;
}

var compacterDisponibilites = function() {
    var resultat = +dispos.join('').split(',').join('');
    return resultat;
};
