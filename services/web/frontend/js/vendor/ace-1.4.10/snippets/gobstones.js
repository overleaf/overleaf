ace.define("ace/snippets/gobstones",[], function(require, exports, module) {
"use strict";

exports.snippetText = "# scope: gobstones\n\
\n\
# program\n\
snippet program\n\
	program {\n\
		${1:// cuerpo...}\n\
	}\n\
\n\
# interactive program\n\
snippet interactive program\n\
	interactive program {\n\
		${1:INIT} -> { ${2:// cuerpo...} }\n\
		${3:TIMEOUT(${4:5000}) -> { ${5:// cuerpo...} }\n\
		${6:K_ENTER} -> { ${7:// cuerpo...} }\n\
		_ -> {}\n\
	}\n\
\n\
# procedure\n\
snippet procedure\n\
	procedure ${1:Nombre}(${2:parametros}) {\n\
		${3:// cuerpo...}\n\
	}\n\
\n\
# function\n\
snippet function\n\
	function ${1:nombre}(${2:parametros}) {\n\
		return (${3:expresión..})\n\
	}\n\
\n\
# return\n\
snippet return\n\
	return (${1:expresión...})\n\
\n\
# type\n\
snippet type\n\
	type ${1:Nombre}\n\
\n\
# is variant\n\
snippet is variant\n\
	is variant {\n\
		case ${1:NombreDelValor1} {}\n\
		case ${2:NombreDelValor2} {}\n\
		case ${3:NombreDelValor3} {}\n\
		case ${4:NombreDelValor4} {}\n\
	}\n\
\n\
# is record\n\
snippet is record\n\
	is record {\n\
		field ${1:campo1} // ${2:Tipo}\n\
		field ${3:campo2} // ${4:Tipo}\n\
		field ${5:campo3} // ${6:Tipo}\n\
		field ${7:campo4} // ${8:Tipo}\n\
	}\n\
\n\
# type _ is variant\n\
snippet type _ is variant\n\
	type ${1:Nombre} is variant {\n\
		case ${2:NombreDelValor1} {}\n\
		case ${3:NombreDelValor2} {}\n\
		case ${4:NombreDelValor3} {}\n\
		case ${5:NombreDelValor4} {}\n\
	}\n\
\n\
# type _ is record\n\
snippet type _ is record\n\
	type ${1:Nombre} is record {\n\
		field ${2:campo1} // ${3:Tipo}\n\
		field ${4:campo2} // ${5:Tipo}\n\
		field ${6:campo3} // ${7:Tipo}\n\
		field ${8:campo4} // ${9:Tipo}\n\
	}\n\
\n\
# repeat\n\
snippet repeat\n\
	repeat ${1:cantidad} {\n\
		${2:// cuerpo...}\n\
	}\n\
\n\
# foreach\n\
snippet foreach\n\
	foreach ${1:índice} in ${2:lista} {\n\
		${3:// cuerpo...}\n\
	}\n\
\n\
# while\n\
snippet while\n\
	while (${1?:condición}) {\n\
		${2:// cuerpo...}\n\
	}\n\
\n\
# if\n\
snippet if\n\
	if (${1?:condición}) {\n\
		${2:// cuerpo...}\n\
	}\n\
\n\
# elseif\n\
snippet elseif\n\
	elseif (${1?:condición}) {\n\
		${2:// cuerpo...}\n\
	}\n\
\n\
# else\n\
snippet else\n\
	else {\n\
		${1:// cuerpo...}\n\
	}\n\
\n\
# if (con else)\n\
snippet if (con else)\n\
	if (${1:condición}) {\n\
		${2:// cuerpo...}\n\
	} else {\n\
		${3:// cuerpo....}\n\
	}\n\
\n\
# if (con elseif)\n\
snippet if (con elseif)\n\
	if (${1:condición}) {\n\
		${2:// cuerpo...}\n\
	} elseif (${3:condición}) {\n\
		${4:// cuerpo...}\n\
	}\n\
\n\
# if (con elseif y else)\n\
snippet if (con elseif y else)\n\
	if (${1:condición}) {\n\
		${2:// cuerpo...}\n\
	} elseif (${3:condición}) {\n\
		${4:// cuerpo...}\n\
	} else {\n\
		${5:// cuerpo....}\n\
	}\n\
\n\
# if (con 3 elseif)\n\
snippet if (con 3 elseif)\n\
	if (${1:condición}) {\n\
		${2:// cuerpo...}\n\
	} elseif (${3:condición}) {\n\
		${4:// cuerpo...}\n\
	} elseif (${5:condición}) {\n\
		${6:// cuerpo...}\n\
	} elseif (${7:condición}) {\n\
		${8:// cuerpo...}\n\
	}\n\
\n\
# choose (2 valores)\n\
snippet choose (2 valores)\n\
	choose\n\
		${1:Valor1} when (${2:condición})\n\
		${3:Valor2} otherwise\n\
\n\
# choose (2 valores y boom)\n\
snippet choose (2 valores y boom)\n\
	choose\n\
		${1:Valor1} when (${2:condición})\n\
		${3:Valor2} when (${4:condición})\n\
		${5:Valor3} when (${6:condición})\n\
		${7:Valor4} when (${8:condición})\n\
		boom(\"${9:No es un valor válido}\") otherwise\n\
\n\
# matching (4 valores)\n\
snippet matching (4 valores)\n\
	matching (${1:variable}) select\n\
		${2:Valor1} on ${3:opción1}\n\
		${4:Valor2} on ${5:opción2}\n\
		${6:Valor3} on ${7:opción3}\n\
		${8:Valor4} on ${9:opción4}\n\
		boom(\"${10:No es un valor válido}\") otherwise\n\
\n\
# select (4 casos)\n\
snippet select (4 casos)\n\
	select\n\
		${1:Valor1} on (${2:opción1})\n\
		${3:Valor2} on (${4:opción2})\n\
		${5:Valor3} on (${6:opción3})\n\
		${7:Valor4} on (${8:opción4})\n\
		boom(\"${9:No es un valor válido}\") otherwise\n\
\n\
# switch\n\
snippet switch\n\
	switch (${1:variable}) {\n\
		${2:Valor1} -> {${3:// cuerpo...}}\n\
		${4:Valor2} -> {${5:// cuerpo...}}\n\
		${6:Valor3} -> {${7:// cuerpo...}}\n\
		${8:Valor4} -> {${9:// cuerpo...}}\n\
		_ -> {${10:// cuerpo...}}\n\
	}\n\
\n\
# Poner\n\
snippet Poner\n\
	Poner(${1:color})\n\
\n\
# Sacar\n\
snippet Sacar\n\
	Sacar(${1:color})\n\
\n\
# Mover\n\
snippet Mover\n\
	Mover(${1:dirección})\n\
\n\
# IrAlBorde\n\
snippet IrAlBorde\n\
	IrAlBorde(${1:dirección})\n\
\n\
# VaciarTablero\n\
snippet VaciarTablero\n\
	VaciarTablero()\n\
\n\
# BOOM\n\
snippet BOOM\n\
	BOOM(\"${1:Mensaje de error}\")\n\
\n\
# hayBolitas\n\
snippet hayBolitas\n\
	hayBolitas(${1:color})\n\
\n\
# nroBolitas\n\
snippet nroBolitas\n\
	nroBolitas(${1:color})\n\
\n\
# puedeMover\n\
snippet puedeMover\n\
	puedeMover(${1:dirección})\n\
\n\
# siguiente\n\
snippet siguiente\n\
	siguiente(${1:color|dirección})\n\
\n\
# previo\n\
snippet previo\n\
	previo(${1:color|dirección})\n\
\n\
# opuesto\n\
snippet opuesto\n\
	opuesto(${1:dirección})\n\
\n\
# minDir\n\
snippet minDir\n\
	minDir()\n\
\n\
# maxDir\n\
snippet maxDir\n\
	maxDir()\n\
\n\
# minColor\n\
snippet minColor\n\
	minDir()\n\
\n\
# maxColor\n\
snippet maxColor\n\
	maxDir()\n\
\n\
# minBool\n\
snippet minBool\n\
	minBool()\n\
\n\
# maxBool\n\
snippet maxBool\n\
	maxBool()\n\
\n\
# primero\n\
snippet primero\n\
	primero(${1:lista})\n\
\n\
# sinElPrimero\n\
snippet sinElPrimero\n\
	sinElPrimero(${1:lista})\n\
\n\
# esVacía\n\
snippet esVacía\n\
	esVacía(${1:lista})\n\
\n\
# boom\n\
snippet boom\n\
	boom(\"${1:Mensaje de error}\")\n\
\n\
# Azul\n\
snippet Azul\n\
	Azul\n\
\n\
# Negro\n\
snippet Negro\n\
	Negro\n\
\n\
# Rojo\n\
snippet Rojo\n\
	Rojo\n\
\n\
# Verde\n\
snippet Verde\n\
	Verde\n\
\n\
# Norte\n\
snippet Norte\n\
	Norte\n\
\n\
# Este\n\
snippet Este\n\
	Este\n\
\n\
# Sur\n\
snippet Sur\n\
	Sur\n\
\n\
# Oeste\n\
snippet Oeste\n\
	Oeste\n\
\n\
# True\n\
snippet True\n\
	True\n\
\n\
# False\n\
snippet False\n\
	False\n\
\n\
# INIT\n\
snippet INIT\n\
	INIT -> {$1:// cuerpo...}\n\
\n\
# TIMEOUT\n\
snippet TIMEOUT\n\
	TIMEOUT(${1:5000}) -> {$2:// cuerpo...}\n\
\n\
# K_A\n\
snippet K_A\n\
	K_A -> { ${1://cuerpo...} }\n\
# K_CTRL_A\n\
snippet K_CTRL_A\n\
	K_CTRL_A -> { ${1://cuerpo...} }\n\
# K_ALT_A\n\
snippet K_ALT_A\n\
	K_ALT_A -> { ${1://cuerpo...} }\n\
# K_SHIFT_A\n\
snippet K_SHIFT_A\n\
	K_SHIFT_A -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_A\n\
snippet K_CTRL_ALT_A\n\
	K_CTRL_ALT_A -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_A\n\
snippet K_CTRL_SHIFT_A\n\
	K_CTRL_SHIFT_A -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_A\n\
snippet K_CTRL_ALT_SHIFT_A\n\
	K_CTRL_ALT_SHIFT_A -> { ${1://cuerpo...} }\n\
\n\
# K_B\n\
snippet K_B\n\
	K_B -> { ${1://cuerpo...} }\n\
# K_CTRL_B\n\
snippet K_CTRL_B\n\
	K_CTRL_B -> { ${1://cuerpo...} }\n\
# K_ALT_B\n\
snippet K_ALT_B\n\
	K_ALT_B -> { ${1://cuerpo...} }\n\
# K_SHIFT_B\n\
snippet K_SHIFT_B\n\
	K_SHIFT_B -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_B\n\
snippet K_CTRL_ALT_B\n\
	K_CTRL_ALT_B -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_B\n\
snippet K_CTRL_SHIFT_B\n\
	K_CTRL_SHIFT_B -> { ${1://cuerpo...} }\n\
# K_ALT_SHIFT_C\n\
snippet K_ALT_SHIFT_C\n\
	K_ALT_SHIFT_C -> { ${1://cuerpo...} }\n\
# K_CTRL_BLT_SHIFT_B\n\
snippet K_CTRL_BLT_SHIFT_B\n\
	K_CTRL_ALT_SHIFT_B -> { ${1://cuerpo...} }\n\
\n\
# K_C\n\
snippet K_C\n\
	K_C -> { ${1://cuerpo...} }\n\
# K_CTRL_C\n\
snippet K_CTRL_C\n\
	K_CTRL_C -> { ${1://cuerpo...} }\n\
# K_ALT_C\n\
snippet K_ALT_C\n\
	K_ALT_C -> { ${1://cuerpo...} }\n\
# K_SHIFT_C\n\
snippet K_SHIFT_C\n\
	K_SHIFT_C -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_C\n\
snippet K_CTRL_ALT_C\n\
	K_CTRL_ALT_C -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_C\n\
snippet K_CTRL_SHIFT_C\n\
	K_CTRL_SHIFT_C -> { ${1://cuerpo...} }\n\
# K_ALT_SHIFT_C\n\
snippet K_ALT_SHIFT_C\n\
	K_ALT_SHIFT_C -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_C\n\
snippet K_CTRL_ALT_SHIFT_C\n\
	K_CTRL_ALT_SHIFT_C -> { ${1://cuerpo...} }\n\
\n\
# K_D\n\
snippet K_D\n\
	K_D -> { ${1://cuerpo...} }\n\
# K_CTRL_D\n\
snippet K_CTRL_D\n\
	K_CTRL_D -> { ${1://cuerpo...} }\n\
# K_ALT_D\n\
snippet K_ALT_D\n\
	K_DLT_D -> { ${1://cuerpo...} }\n\
# K_SHIFT_D\n\
snippet K_SHIFT_D\n\
	K_SHIFT_D -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_D\n\
snippet K_CTRL_ALT_D\n\
	K_CTRL_DLT_D -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_D\n\
snippet K_CTRL_SHIFT_D\n\
	K_CTRL_SHIFT_D -> { ${1://cuerpo...} }\n\
# K_ALT_SHIFT_D\n\
snippet K_ALT_SHIFT_D\n\
	K_ALT_SHIFT_D -> { ${1://cuerpo...} }\n\
# K_CTRL_DLT_SHIFT_D\n\
snippet K_CTRL_DLT_SHIFT_D\n\
	K_CTRL_ALT_SHIFT_D -> { ${1://cuerpo...} }\n\
\n\
# K_E\n\
snippet K_E\n\
	K_E -> { ${1://cuerpo...} }\n\
# K_CTRL_E\n\
snippet K_CTRL_E\n\
	K_CTRL_E -> { ${1://cuerpo...} }\n\
# K_ALT_E\n\
snippet K_ALT_E\n\
	K_ALT_E -> { ${1://cuerpo...} }\n\
# K_SHIFT_E\n\
snippet K_SHIFT_E\n\
	K_SHIFT_E -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_E\n\
snippet K_CTRL_ALT_E\n\
	K_CTRL_ALT_E -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_E\n\
snippet K_CTRL_SHIFT_E\n\
	K_CTRL_SHIFT_E -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_E\n\
snippet K_CTRL_ALT_SHIFT_E\n\
	K_CTRL_ALT_SHIFT_E -> { ${1://cuerpo...} }\n\
\n\
# K_F\n\
snippet K_F\n\
	K_F -> { ${1://cuerpo...} }\n\
# K_CTRL_F\n\
snippet K_CTRL_F\n\
	K_CTRL_F -> { ${1://cuerpo...} }\n\
# K_ALT_F\n\
snippet K_ALT_F\n\
	K_ALT_F -> { ${1://cuerpo...} }\n\
# K_SHIFT_F\n\
snippet K_SHIFT_F\n\
	K_SHIFT_F -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_F\n\
snippet K_CTRL_ALT_F\n\
	K_CTRL_ALT_F -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_F\n\
snippet K_CTRL_SHIFT_F\n\
	K_CTRL_SHIFT_F -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_F\n\
snippet K_CTRL_ALT_SHIFT_F\n\
	K_CTRL_ALT_SHIFT_F -> { ${1://cuerpo...} }\n\
\n\
# K_G\n\
snippet K_G\n\
	K_G -> { ${1://cuerpo...} }\n\
# K_CTRL_G\n\
snippet K_CTRL_G\n\
	K_CTRL_G -> { ${1://cuerpo...} }\n\
# K_ALT_G\n\
snippet K_ALT_G\n\
	K_ALT_G -> { ${1://cuerpo...} }\n\
# K_SHIFT_G\n\
snippet K_SHIFT_G\n\
	K_SHIFT_G -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_G\n\
snippet K_CTRL_ALT_G\n\
	K_CTRL_ALT_G -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_G\n\
snippet K_CTRL_SHIFT_G\n\
	K_CTRL_SHIFT_G -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_G\n\
snippet K_CTRL_ALT_SHIFT_G\n\
	K_CTRL_ALT_SHIFT_G -> { ${1://cuerpo...} }\n\
\n\
# K_H\n\
snippet K_H\n\
	K_H -> { ${1://cuerpo...} }\n\
# K_CTRL_H\n\
snippet K_CTRL_H\n\
	K_CTRL_H -> { ${1://cuerpo...} }\n\
# K_ALT_H\n\
snippet K_ALT_H\n\
	K_ALT_H -> { ${1://cuerpo...} }\n\
# K_SHIFT_H\n\
snippet K_SHIFT_H\n\
	K_SHIFT_H -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_H\n\
snippet K_CTRL_ALT_H\n\
	K_CTRL_ALT_H -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_H\n\
snippet K_CTRL_SHIFT_H\n\
	K_CTRL_SHIFT_H -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_H\n\
snippet K_CTRL_ALT_SHIFT_H\n\
	K_CTRL_ALT_SHIFT_H -> { ${1://cuerpo...} }\n\
\n\
# K_I\n\
snippet K_I\n\
	K_I -> { ${1://cuerpo...} }\n\
# K_CTRL_I\n\
snippet K_CTRL_I\n\
	K_CTRL_I -> { ${1://cuerpo...} }\n\
# K_ALT_I\n\
snippet K_ALT_I\n\
	K_ALT_I -> { ${1://cuerpo...} }\n\
# K_SHIFT_I\n\
snippet K_SHIFT_I\n\
	K_SHIFT_I -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_I\n\
snippet K_CTRL_ALT_I\n\
	K_CTRL_ALT_I -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_I\n\
snippet K_CTRL_SHIFT_I\n\
	K_CTRL_SHIFT_I -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_I\n\
snippet K_CTRL_ALT_SHIFT_I\n\
	K_CTRL_ALT_SHIFT_I -> { ${1://cuerpo...} }\n\
\n\
# K_J\n\
snippet K_J\n\
	K_J -> { ${1://cuerpo...} }\n\
# K_CTRL_J\n\
snippet K_CTRL_J\n\
	K_CTRL_J -> { ${1://cuerpo...} }\n\
# K_ALT_J\n\
snippet K_ALT_J\n\
	K_ALT_J -> { ${1://cuerpo...} }\n\
# K_SHIFT_J\n\
snippet K_SHIFT_J\n\
	K_SHIFT_J -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_J\n\
snippet K_CTRL_ALT_J\n\
	K_CTRL_ALT_J -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_J\n\
snippet K_CTRL_SHIFT_J\n\
	K_CTRL_SHIFT_J -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_J\n\
snippet K_CTRL_ALT_SHIFT_J\n\
	K_CTRL_ALT_SHIFT_J -> { ${1://cuerpo...} }\n\
\n\
# K_K\n\
snippet K_K\n\
	K_K -> { ${1://cuerpo...} }\n\
# K_CTRL_K\n\
snippet K_CTRL_K\n\
	K_CTRL_K -> { ${1://cuerpo...} }\n\
# K_ALT_K\n\
snippet K_ALT_K\n\
	K_ALT_K -> { ${1://cuerpo...} }\n\
# K_SHIFT_K\n\
snippet K_SHIFT_K\n\
	K_SHIFT_K -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_K\n\
snippet K_CTRL_ALT_K\n\
	K_CTRL_ALT_K -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_K\n\
snippet K_CTRL_SHIFT_K\n\
	K_CTRL_SHIFT_K -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_K\n\
snippet K_CTRL_ALT_SHIFT_K\n\
	K_CTRL_ALT_SHIFT_K -> { ${1://cuerpo...} }\n\
\n\
# K_L\n\
snippet K_L\n\
	K_L -> { ${1://cuerpo...} }\n\
# K_CTRL_L\n\
snippet K_CTRL_L\n\
	K_CTRL_L -> { ${1://cuerpo...} }\n\
# K_ALT_L\n\
snippet K_ALT_L\n\
	K_ALT_L -> { ${1://cuerpo...} }\n\
# K_SHIFT_L\n\
snippet K_SHIFT_L\n\
	K_SHIFT_L -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_L\n\
snippet K_CTRL_ALT_L\n\
	K_CTRL_ALT_L -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_L\n\
snippet K_CTRL_SHIFT_L\n\
	K_CTRL_SHIFT_L -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_L\n\
snippet K_CTRL_ALT_SHIFT_L\n\
	K_CTRL_ALT_SHIFT_L -> { ${1://cuerpo...} }\n\
\n\
# K_M\n\
snippet K_M\n\
	K_M -> { ${1://cuerpo...} }\n\
# K_CTRL_M\n\
snippet K_CTRL_M\n\
	K_CTRL_M -> { ${1://cuerpo...} }\n\
# K_ALT_M\n\
snippet K_ALT_M\n\
	K_ALT_M -> { ${1://cuerpo...} }\n\
# K_SHIFT_M\n\
snippet K_SHIFT_M\n\
	K_SHIFT_M -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_M\n\
snippet K_CTRL_ALT_M\n\
	K_CTRL_ALT_M -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_M\n\
snippet K_CTRL_SHIFT_M\n\
	K_CTRL_SHIFT_M -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_M\n\
snippet K_CTRL_ALT_SHIFT_M\n\
	K_CTRL_ALT_SHIFT_M -> { ${1://cuerpo...} }\n\
\n\
# K_N\n\
snippet K_N\n\
	K_N -> { ${1://cuerpo...} }\n\
# K_CTRL_N\n\
snippet K_CTRL_N\n\
	K_CTRL_N -> { ${1://cuerpo...} }\n\
# K_ALT_N\n\
snippet K_ALT_N\n\
	K_ALT_N -> { ${1://cuerpo...} }\n\
# K_SHIFT_N\n\
snippet K_SHIFT_N\n\
	K_SHIFT_N -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_N\n\
snippet K_CTRL_ALT_N\n\
	K_CTRL_ALT_N -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_N\n\
snippet K_CTRL_SHIFT_N\n\
	K_CTRL_SHIFT_N -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_N\n\
snippet K_CTRL_ALT_SHIFT_N\n\
	K_CTRL_ALT_SHIFT_N -> { ${1://cuerpo...} }\n\
\n\
# K_Ñ\n\
snippet K_Ñ\n\
	K_Ñ -> { ${1://cuerpo...} }\n\
# K_CTRL_Ñ\n\
snippet K_CTRL_Ñ\n\
	K_CTRL_Ñ -> { ${1://cuerpo...} }\n\
# K_ALT_Ñ\n\
snippet K_ALT_Ñ\n\
	K_ALT_Ñ -> { ${1://cuerpo...} }\n\
# K_SHIFT_Ñ\n\
snippet K_SHIFT_Ñ\n\
	K_SHIFT_Ñ -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_Ñ\n\
snippet K_CTRL_ALT_Ñ\n\
	K_CTRL_ALT_Ñ -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_Ñ\n\
snippet K_CTRL_SHIFT_Ñ\n\
	K_CTRL_SHIFT_Ñ -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_Ñ\n\
snippet K_CTRL_ALT_SHIFT_Ñ\n\
	K_CTRL_ALT_SHIFT_Ñ -> { ${1://cuerpo...} }\n\
\n\
# K_O\n\
snippet K_O\n\
	K_O -> { ${1://cuerpo...} }\n\
# K_CTRL_O\n\
snippet K_CTRL_O\n\
	K_CTRL_O -> { ${1://cuerpo...} }\n\
# K_ALT_O\n\
snippet K_ALT_O\n\
	K_ALT_O -> { ${1://cuerpo...} }\n\
# K_SHIFT_O\n\
snippet K_SHIFT_O\n\
	K_SHIFT_O -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_O\n\
snippet K_CTRL_ALT_O\n\
	K_CTRL_ALT_O -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_O\n\
snippet K_CTRL_SHIFT_O\n\
	K_CTRL_SHIFT_O -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_O\n\
snippet K_CTRL_ALT_SHIFT_O\n\
	K_CTRL_ALT_SHIFT_O -> { ${1://cuerpo...} }\n\
\n\
# K_P\n\
snippet K_P\n\
	K_P -> { ${1://cuerpo...} }\n\
# K_CTRL_P\n\
snippet K_CTRL_P\n\
	K_CTRL_P -> { ${1://cuerpo...} }\n\
# K_ALT_P\n\
snippet K_ALT_P\n\
	K_ALT_P -> { ${1://cuerpo...} }\n\
# K_SHIFT_P\n\
snippet K_SHIFT_P\n\
	K_SHIFT_P -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_P\n\
snippet K_CTRL_ALT_P\n\
	K_CTRL_ALT_P -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_P\n\
snippet K_CTRL_SHIFT_P\n\
	K_CTRL_SHIFT_P -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_P\n\
snippet K_CTRL_ALT_SHIFT_P\n\
	K_CTRL_ALT_SHIFT_P -> { ${1://cuerpo...} }\n\
\n\
# K_Q\n\
snippet K_Q\n\
	K_Q -> { ${1://cuerpo...} }\n\
# K_CTRL_Q\n\
snippet K_CTRL_Q\n\
	K_CTRL_Q -> { ${1://cuerpo...} }\n\
# K_ALT_Q\n\
snippet K_ALT_Q\n\
	K_ALT_Q -> { ${1://cuerpo...} }\n\
# K_SHIFT_Q\n\
snippet K_SHIFT_Q\n\
	K_SHIFT_Q -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_Q\n\
snippet K_CTRL_ALT_Q\n\
	K_CTRL_ALT_Q -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_Q\n\
snippet K_CTRL_SHIFT_Q\n\
	K_CTRL_SHIFT_Q -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_Q\n\
snippet K_CTRL_ALT_SHIFT_Q\n\
	K_CTRL_ALT_SHIFT_Q -> { ${1://cuerpo...} }\n\
\n\
# K_R\n\
snippet K_R\n\
	K_R -> { ${1://cuerpo...} }\n\
# K_CTRL_R\n\
snippet K_CTRL_R\n\
	K_CTRL_R -> { ${1://cuerpo...} }\n\
# K_ALT_R\n\
snippet K_ALT_R\n\
	K_ALT_R -> { ${1://cuerpo...} }\n\
# K_SHIFT_R\n\
snippet K_SHIFT_R\n\
	K_SHIFT_R -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_R\n\
snippet K_CTRL_ALT_R\n\
	K_CTRL_ALT_R -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_R\n\
snippet K_CTRL_SHIFT_R\n\
	K_CTRL_SHIFT_R -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_R\n\
snippet K_CTRL_ALT_SHIFT_R\n\
	K_CTRL_ALT_SHIFT_R -> { ${1://cuerpo...} }\n\
\n\
# K_S\n\
snippet K_S\n\
	K_S -> { ${1://cuerpo...} }\n\
# K_CTRL_S\n\
snippet K_CTRL_S\n\
	K_CTRL_S -> { ${1://cuerpo...} }\n\
# K_ALT_S\n\
snippet K_ALT_S\n\
	K_ALT_S -> { ${1://cuerpo...} }\n\
# K_SHIFT_S\n\
snippet K_SHIFT_S\n\
	K_SHIFT_S -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_S\n\
snippet K_CTRL_ALT_S\n\
	K_CTRL_ALT_S -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_S\n\
snippet K_CTRL_SHIFT_S\n\
	K_CTRL_SHIFT_S -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_S\n\
snippet K_CTRL_ALT_SHIFT_S\n\
	K_CTRL_ALT_SHIFT_S -> { ${1://cuerpo...} }\n\
\n\
# K_T\n\
snippet K_T\n\
	K_T -> { ${1://cuerpo...} }\n\
# K_CTRL_T\n\
snippet K_CTRL_T\n\
	K_CTRL_T -> { ${1://cuerpo...} }\n\
# K_ALT_T\n\
snippet K_ALT_T\n\
	K_ALT_T -> { ${1://cuerpo...} }\n\
# K_SHIFT_T\n\
snippet K_SHIFT_T\n\
	K_SHIFT_T -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_T\n\
snippet K_CTRL_ALT_T\n\
	K_CTRL_ALT_T -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_T\n\
snippet K_CTRL_SHIFT_T\n\
	K_CTRL_SHIFT_T -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_T\n\
snippet K_CTRL_ALT_SHIFT_T\n\
	K_CTRL_ALT_SHIFT_T -> { ${1://cuerpo...} }\n\
\n\
# K_U\n\
snippet K_U\n\
	K_U -> { ${1://cuerpo...} }\n\
# K_CTRL_U\n\
snippet K_CTRL_U\n\
	K_CTRL_U -> { ${1://cuerpo...} }\n\
# K_ALT_U\n\
snippet K_ALT_U\n\
	K_ALT_U -> { ${1://cuerpo...} }\n\
# K_SHIFT_U\n\
snippet K_SHIFT_U\n\
	K_SHIFT_U -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_U\n\
snippet K_CTRL_ALT_U\n\
	K_CTRL_ALT_U -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_U\n\
snippet K_CTRL_SHIFT_U\n\
	K_CTRL_SHIFT_U -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_U\n\
snippet K_CTRL_ALT_SHIFT_U\n\
	K_CTRL_ALT_SHIFT_U -> { ${1://cuerpo...} }\n\
\n\
# K_V\n\
snippet K_V\n\
	K_V -> { ${1://cuerpo...} }\n\
# K_CTRL_V\n\
snippet K_CTRL_V\n\
	K_CTRL_V -> { ${1://cuerpo...} }\n\
# K_ALT_V\n\
snippet K_ALT_V\n\
	K_ALT_V -> { ${1://cuerpo...} }\n\
# K_SHIFT_V\n\
snippet K_SHIFT_V\n\
	K_SHIFT_V -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_V\n\
snippet K_CTRL_ALT_V\n\
	K_CTRL_ALT_V -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_V\n\
snippet K_CTRL_SHIFT_V\n\
	K_CTRL_SHIFT_V -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_V\n\
snippet K_CTRL_ALT_SHIFT_V\n\
	K_CTRL_ALT_SHIFT_V -> { ${1://cuerpo...} }\n\
\n\
# K_W\n\
snippet K_W\n\
	K_W -> { ${1://cuerpo...} }\n\
# K_CTRL_W\n\
snippet K_CTRL_W\n\
	K_CTRL_W -> { ${1://cuerpo...} }\n\
# K_ALT_W\n\
snippet K_ALT_W\n\
	K_ALT_W -> { ${1://cuerpo...} }\n\
# K_SHIFT_W\n\
snippet K_SHIFT_W\n\
	K_SHIFT_W -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_W\n\
snippet K_CTRL_ALT_W\n\
	K_CTRL_ALT_W -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_W\n\
snippet K_CTRL_SHIFT_W\n\
	K_CTRL_SHIFT_W -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_W\n\
snippet K_CTRL_ALT_SHIFT_W\n\
	K_CTRL_ALT_SHIFT_W -> { ${1://cuerpo...} }\n\
\n\
# K_X\n\
snippet K_X\n\
	K_X -> { ${1://cuerpo...} }\n\
# K_CTRL_X\n\
snippet K_CTRL_X\n\
	K_CTRL_X -> { ${1://cuerpo...} }\n\
# K_ALT_X\n\
snippet K_ALT_X\n\
	K_ALT_X -> { ${1://cuerpo...} }\n\
# K_SHIFT_X\n\
snippet K_SHIFT_X\n\
	K_SHIFT_X -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_X\n\
snippet K_CTRL_ALT_X\n\
	K_CTRL_ALT_X -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_X\n\
snippet K_CTRL_SHIFT_X\n\
	K_CTRL_SHIFT_X -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_X\n\
snippet K_CTRL_ALT_SHIFT_X\n\
	K_CTRL_ALT_SHIFT_X -> { ${1://cuerpo...} }\n\
\n\
# K_Y\n\
snippet K_Y\n\
	K_Y -> { ${1://cuerpo...} }\n\
# K_CTRL_Y\n\
snippet K_CTRL_Y\n\
	K_CTRL_Y -> { ${1://cuerpo...} }\n\
# K_ALT_Y\n\
snippet K_ALT_Y\n\
	K_ALT_Y -> { ${1://cuerpo...} }\n\
# K_SHIFT_Y\n\
snippet K_SHIFT_Y\n\
	K_SHIFT_Y -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_Y\n\
snippet K_CTRL_ALT_Y\n\
	K_CTRL_ALT_Y -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_Y\n\
snippet K_CTRL_SHIFT_Y\n\
	K_CTRL_SHIFT_Y -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_Y\n\
snippet K_CTRL_ALT_SHIFT_Y\n\
	K_CTRL_ALT_SHIFT_Y -> { ${1://cuerpo...} }\n\
\n\
# K_Z\n\
snippet K_Z\n\
	K_Z -> { ${1://cuerpo...} }\n\
# K_CTRL_Z\n\
snippet K_CTRL_Z\n\
	K_CTRL_Z -> { ${1://cuerpo...} }\n\
# K_ALT_Z\n\
snippet K_ALT_Z\n\
	K_ALT_Z -> { ${1://cuerpo...} }\n\
# K_SHIFT_Z\n\
snippet K_SHIFT_Z\n\
	K_SHIFT_Z -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_Z\n\
snippet K_CTRL_ALT_Z\n\
	K_CTRL_ALT_Z -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_Z\n\
snippet K_CTRL_SHIFT_Z\n\
	K_CTRL_SHIFT_Z -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_Z\n\
snippet K_CTRL_ALT_SHIFT_Z\n\
	K_CTRL_ALT_SHIFT_Z -> { ${1://cuerpo...} }\n\
\n\
# K_0\n\
snippet K_0\n\
	K_0 -> { ${1://cuerpo...} }\n\
# K_CTRL_0\n\
snippet K_CTRL_0\n\
	K_CTRL_0 -> { ${1://cuerpo...} }\n\
# K_ALT_0\n\
snippet K_ALT_0\n\
	K_ALT_0 -> { ${1://cuerpo...} }\n\
# K_SHIFT_0\n\
snippet K_SHIFT_0\n\
	K_SHIFT_0 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_0\n\
snippet K_CTRL_ALT_0\n\
	K_CTRL_ALT_0 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_0\n\
snippet K_CTRL_SHIFT_0\n\
	K_CTRL_SHIFT_0 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_0\n\
snippet K_CTRL_ALT_SHIFT_0\n\
	K_CTRL_ALT_SHIFT_0 -> { ${1://cuerpo...} }\n\
\n\
# K_1\n\
snippet K_1\n\
	K_1 -> { ${1://cuerpo...} }\n\
# K_CTRL_1\n\
snippet K_CTRL_1\n\
	K_CTRL_1 -> { ${1://cuerpo...} }\n\
# K_ALT_1\n\
snippet K_ALT_1\n\
	K_ALT_1 -> { ${1://cuerpo...} }\n\
# K_SHIFT_1\n\
snippet K_SHIFT_1\n\
	K_SHIFT_1 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_1\n\
snippet K_CTRL_ALT_1\n\
	K_CTRL_ALT_1 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_1\n\
snippet K_CTRL_SHIFT_1\n\
	K_CTRL_SHIFT_1 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_1\n\
snippet K_CTRL_ALT_SHIFT_1\n\
	K_CTRL_ALT_SHIFT_1 -> { ${1://cuerpo...} }\n\
\n\
# K_2\n\
snippet K_2\n\
	K_2 -> { ${1://cuerpo...} }\n\
# K_CTRL_2\n\
snippet K_CTRL_2\n\
	K_CTRL_2 -> { ${1://cuerpo...} }\n\
# K_ALT_2\n\
snippet K_ALT_2\n\
	K_ALT_2 -> { ${1://cuerpo...} }\n\
# K_SHIFT_2\n\
snippet K_SHIFT_2\n\
	K_SHIFT_2 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_2\n\
snippet K_CTRL_ALT_2\n\
	K_CTRL_ALT_2 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_2\n\
snippet K_CTRL_SHIFT_2\n\
	K_CTRL_SHIFT_2 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_2\n\
snippet K_CTRL_ALT_SHIFT_2\n\
	K_CTRL_ALT_SHIFT_2 -> { ${1://cuerpo...} }\n\
\n\
# K_3\n\
snippet K_3\n\
	K_3 -> { ${1://cuerpo...} }\n\
# K_CTRL_3\n\
snippet K_CTRL_3\n\
	K_CTRL_3 -> { ${1://cuerpo...} }\n\
# K_ALT_3\n\
snippet K_ALT_3\n\
	K_ALT_3 -> { ${1://cuerpo...} }\n\
# K_SHIFT_3\n\
snippet K_SHIFT_3\n\
	K_SHIFT_3 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_3\n\
snippet K_CTRL_ALT_3\n\
	K_CTRL_ALT_3 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_3\n\
snippet K_CTRL_SHIFT_3\n\
	K_CTRL_SHIFT_3 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_3\n\
snippet K_CTRL_ALT_SHIFT_3\n\
	K_CTRL_ALT_SHIFT_3 -> { ${1://cuerpo...} }\n\
\n\
# K_4\n\
snippet K_4\n\
	K_4 -> { ${1://cuerpo...} }\n\
# K_CTRL_4\n\
snippet K_CTRL_4\n\
	K_CTRL_4 -> { ${1://cuerpo...} }\n\
# K_ALT_4\n\
snippet K_ALT_4\n\
	K_ALT_4 -> { ${1://cuerpo...} }\n\
# K_SHIFT_4\n\
snippet K_SHIFT_4\n\
	K_SHIFT_4 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_4\n\
snippet K_CTRL_ALT_4\n\
	K_CTRL_ALT_4 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_4\n\
snippet K_CTRL_SHIFT_4\n\
	K_CTRL_SHIFT_4 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_4\n\
snippet K_CTRL_ALT_SHIFT_4\n\
	K_CTRL_ALT_SHIFT_4 -> { ${1://cuerpo...} }\n\
\n\
# K_5\n\
snippet K_5\n\
	K_5 -> { ${1://cuerpo...} }\n\
# K_CTRL_5\n\
snippet K_CTRL_5\n\
	K_CTRL_5 -> { ${1://cuerpo...} }\n\
# K_ALT_5\n\
snippet K_ALT_5\n\
	K_ALT_5 -> { ${1://cuerpo...} }\n\
# K_SHIFT_5\n\
snippet K_SHIFT_5\n\
	K_SHIFT_5 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_5\n\
snippet K_CTRL_ALT_5\n\
	K_CTRL_ALT_5 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_5\n\
snippet K_CTRL_SHIFT_5\n\
	K_CTRL_SHIFT_5 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_5\n\
snippet K_CTRL_ALT_SHIFT_5\n\
	K_CTRL_ALT_SHIFT_5 -> { ${1://cuerpo...} }\n\
\n\
# K_6\n\
snippet K_6\n\
	K_6 -> { ${1://cuerpo...} }\n\
# K_CTRL_6\n\
snippet K_CTRL_6\n\
	K_CTRL_6 -> { ${1://cuerpo...} }\n\
# K_ALT_6\n\
snippet K_ALT_6\n\
	K_ALT_6 -> { ${1://cuerpo...} }\n\
# K_SHIFT_6\n\
snippet K_SHIFT_6\n\
	K_SHIFT_6 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_6\n\
snippet K_CTRL_ALT_6\n\
	K_CTRL_ALT_6 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_6\n\
snippet K_CTRL_SHIFT_6\n\
	K_CTRL_SHIFT_6 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_6\n\
snippet K_CTRL_ALT_SHIFT_6\n\
	K_CTRL_ALT_SHIFT_6 -> { ${1://cuerpo...} }\n\
\n\
# K_7\n\
snippet K_7\n\
	K_7 -> { ${1://cuerpo...} }\n\
# K_CTRL_7\n\
snippet K_CTRL_7\n\
	K_CTRL_7 -> { ${1://cuerpo...} }\n\
# K_ALT_7\n\
snippet K_ALT_7\n\
	K_ALT_7 -> { ${1://cuerpo...} }\n\
# K_SHIFT_7\n\
snippet K_SHIFT_7\n\
	K_SHIFT_7 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_7\n\
snippet K_CTRL_ALT_7\n\
	K_CTRL_ALT_7 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_7\n\
snippet K_CTRL_SHIFT_7\n\
	K_CTRL_SHIFT_7 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_7\n\
snippet K_CTRL_ALT_SHIFT_7\n\
	K_CTRL_ALT_SHIFT_7 -> { ${1://cuerpo...} }\n\
\n\
# K_8\n\
snippet K_8\n\
	K_8 -> { ${1://cuerpo...} }\n\
# K_CTRL_8\n\
snippet K_CTRL_8\n\
	K_CTRL_8 -> { ${1://cuerpo...} }\n\
# K_ALT_8\n\
snippet K_ALT_8\n\
	K_ALT_8 -> { ${1://cuerpo...} }\n\
# K_SHIFT_8\n\
snippet K_SHIFT_8\n\
	K_SHIFT_8 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_8\n\
snippet K_CTRL_ALT_8\n\
	K_CTRL_ALT_8 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_8\n\
snippet K_CTRL_SHIFT_8\n\
	K_CTRL_SHIFT_8 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_8\n\
snippet K_CTRL_ALT_SHIFT_8\n\
	K_CTRL_ALT_SHIFT_8 -> { ${1://cuerpo...} }\n\
\n\
# K_9\n\
snippet K_9\n\
	K_9 -> { ${1://cuerpo...} }\n\
# K_CTRL_9\n\
snippet K_CTRL_9\n\
	K_CTRL_9 -> { ${1://cuerpo...} }\n\
# K_ALT_9\n\
snippet K_ALT_9\n\
	K_ALT_9 -> { ${1://cuerpo...} }\n\
# K_SHIFT_9\n\
snippet K_SHIFT_9\n\
	K_SHIFT_9 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_9\n\
snippet K_CTRL_ALT_9\n\
	K_CTRL_ALT_9 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_9\n\
snippet K_CTRL_SHIFT_9\n\
	K_CTRL_SHIFT_9 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_9\n\
snippet K_CTRL_ALT_SHIFT_9\n\
	K_CTRL_ALT_SHIFT_9 -> { ${1://cuerpo...} }\n\
\n\
# K_F1\n\
snippet K_F1\n\
	K_F1 -> { ${1://cuerpo...} }\n\
# K_CTRL_F1\n\
snippet K_CTRL_F1\n\
	K_CTRL_F1 -> { ${1://cuerpo...} }\n\
# K_ALT_F1\n\
snippet K_ALT_F1\n\
	K_ALT_F1 -> { ${1://cuerpo...} }\n\
# K_SHIFT_F1\n\
snippet K_SHIFT_F1\n\
	K_SHIFT_F1 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_F1\n\
snippet K_CTRL_ALT_F1\n\
	K_CTRL_ALT_F1 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_F1\n\
snippet K_CTRL_SHIFT_F1\n\
	K_CTRL_SHIFT_F1 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_F1\n\
snippet K_CTRL_ALT_SHIFT_F1\n\
	K_CTRL_ALT_SHIFT_F1 -> { ${1://cuerpo...} }\n\
\n\
# K_F2\n\
snippet K_F2\n\
	K_F2 -> { ${1://cuerpo...} }\n\
# K_CTRL_F2\n\
snippet K_CTRL_F2\n\
	K_CTRL_F2 -> { ${1://cuerpo...} }\n\
# K_ALT_F2\n\
snippet K_ALT_F2\n\
	K_ALT_F2 -> { ${1://cuerpo...} }\n\
# K_SHIFT_F2\n\
snippet K_SHIFT_F2\n\
	K_SHIFT_F2 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_F2\n\
snippet K_CTRL_ALT_F2\n\
	K_CTRL_ALT_F2 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_F2\n\
snippet K_CTRL_SHIFT_F2\n\
	K_CTRL_SHIFT_F2 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_F2\n\
snippet K_CTRL_ALT_SHIFT_F2\n\
	K_CTRL_ALT_SHIFT_F2 -> { ${1://cuerpo...} }\n\
\n\
# K_F3\n\
snippet K_F3\n\
	K_F3 -> { ${1://cuerpo...} }\n\
# K_CTRL_F3\n\
snippet K_CTRL_F3\n\
	K_CTRL_F3 -> { ${1://cuerpo...} }\n\
# K_ALT_F3\n\
snippet K_ALT_F3\n\
	K_ALT_F3 -> { ${1://cuerpo...} }\n\
# K_SHIFT_F3\n\
snippet K_SHIFT_F3\n\
	K_SHIFT_F3 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_F3\n\
snippet K_CTRL_ALT_F3\n\
	K_CTRL_ALT_F3 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_F3\n\
snippet K_CTRL_SHIFT_F3\n\
	K_CTRL_SHIFT_F3 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_F3\n\
snippet K_CTRL_ALT_SHIFT_F3\n\
	K_CTRL_ALT_SHIFT_F3 -> { ${1://cuerpo...} }\n\
\n\
# K_A\n\
snippet K_A\n\
	K_A -> { ${1://cuerpo...} }\n\
# K_CTRL_A\n\
snippet K_CTRL_A\n\
	K_CTRL_A -> { ${1://cuerpo...} }\n\
# K_ALT_A\n\
snippet K_ALT_A\n\
	K_ALT_A -> { ${1://cuerpo...} }\n\
# K_SHIFT_A\n\
snippet K_SHIFT_A\n\
	K_SHIFT_A -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_A\n\
snippet K_CTRL_ALT_A\n\
	K_CTRL_ALT_A -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_A\n\
snippet K_CTRL_SHIFT_A\n\
	K_CTRL_SHIFT_A -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_A\n\
snippet K_CTRL_ALT_SHIFT_A\n\
	K_CTRL_ALT_SHIFT_A -> { ${1://cuerpo...} }\n\
\n\
# K_F5\n\
snippet K_F5\n\
	K_F5 -> { ${1://cuerpo...} }\n\
# K_CTRL_F5\n\
snippet K_CTRL_F5\n\
	K_CTRL_F5 -> { ${1://cuerpo...} }\n\
# K_ALT_F5\n\
snippet K_ALT_F5\n\
	K_ALT_F5 -> { ${1://cuerpo...} }\n\
# K_SHIFT_F5\n\
snippet K_SHIFT_F5\n\
	K_SHIFT_F5 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_F5\n\
snippet K_CTRL_ALT_F5\n\
	K_CTRL_ALT_F5 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_F5\n\
snippet K_CTRL_SHIFT_F5\n\
	K_CTRL_SHIFT_F5 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_F5\n\
snippet K_CTRL_ALT_SHIFT_F5\n\
	K_CTRL_ALT_SHIFT_F5 -> { ${1://cuerpo...} }\n\
\n\
# K_F6\n\
snippet K_F6\n\
	K_F6 -> { ${1://cuerpo...} }\n\
# K_CTRL_F6\n\
snippet K_CTRL_F6\n\
	K_CTRL_F6 -> { ${1://cuerpo...} }\n\
# K_ALT_F6\n\
snippet K_ALT_F6\n\
	K_ALT_F6 -> { ${1://cuerpo...} }\n\
# K_SHIFT_F6\n\
snippet K_SHIFT_F6\n\
	K_SHIFT_F6 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_F6\n\
snippet K_CTRL_ALT_F6\n\
	K_CTRL_ALT_F6 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_F6\n\
snippet K_CTRL_SHIFT_F6\n\
	K_CTRL_SHIFT_F6 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_F6\n\
snippet K_CTRL_ALT_SHIFT_F6\n\
	K_CTRL_ALT_SHIFT_F6 -> { ${1://cuerpo...} }\n\
\n\
# K_F7\n\
snippet K_F7\n\
	K_F7 -> { ${1://cuerpo...} }\n\
# K_CTRL_F7\n\
snippet K_CTRL_F7\n\
	K_CTRL_F7 -> { ${1://cuerpo...} }\n\
# K_ALT_F7\n\
snippet K_ALT_F7\n\
	K_ALT_F7 -> { ${1://cuerpo...} }\n\
# K_SHIFT_F7\n\
snippet K_SHIFT_F7\n\
	K_SHIFT_F7 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_F7\n\
snippet K_CTRL_ALT_F7\n\
	K_CTRL_ALT_F7 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_F7\n\
snippet K_CTRL_SHIFT_F7\n\
	K_CTRL_SHIFT_F7 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_F7\n\
snippet K_CTRL_ALT_SHIFT_F7\n\
	K_CTRL_ALT_SHIFT_F7 -> { ${1://cuerpo...} }\n\
\n\
# K_F8\n\
snippet K_F8\n\
	K_F8 -> { ${1://cuerpo...} }\n\
# K_CTRL_F8\n\
snippet K_CTRL_F8\n\
	K_CTRL_F8 -> { ${1://cuerpo...} }\n\
# K_ALT_F8\n\
snippet K_ALT_F8\n\
	K_ALT_F8 -> { ${1://cuerpo...} }\n\
# K_SHIFT_F8\n\
snippet K_SHIFT_F8\n\
	K_SHIFT_F8 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_F8\n\
snippet K_CTRL_ALT_F8\n\
	K_CTRL_ALT_F8 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_F8\n\
snippet K_CTRL_SHIFT_F8\n\
	K_CTRL_SHIFT_F8 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_F8\n\
snippet K_CTRL_ALT_SHIFT_F8\n\
	K_CTRL_ALT_SHIFT_F8 -> { ${1://cuerpo...} }\n\
\n\
# K_F9\n\
snippet K_F9\n\
	K_F9 -> { ${1://cuerpo...} }\n\
# K_CTRL_F9\n\
snippet K_CTRL_F9\n\
	K_CTRL_F9 -> { ${1://cuerpo...} }\n\
# K_ALT_F9\n\
snippet K_ALT_F9\n\
	K_ALT_F9 -> { ${1://cuerpo...} }\n\
# K_SHIFT_F9\n\
snippet K_SHIFT_F9\n\
	K_SHIFT_F9 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_F9\n\
snippet K_CTRL_ALT_F9\n\
	K_CTRL_ALT_F9 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_F9\n\
snippet K_CTRL_SHIFT_F9\n\
	K_CTRL_SHIFT_F9 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_F9\n\
snippet K_CTRL_ALT_SHIFT_F9\n\
	K_CTRL_ALT_SHIFT_F9 -> { ${1://cuerpo...} }\n\
\n\
# K_F10\n\
snippet K_F10\n\
	K_F10 -> { ${1://cuerpo...} }\n\
# K_CTRL_F10\n\
snippet K_CTRL_F10\n\
	K_CTRL_F10 -> { ${1://cuerpo...} }\n\
# K_ALT_F10\n\
snippet K_ALT_F10\n\
	K_ALT_F10 -> { ${1://cuerpo...} }\n\
# K_SHIFT_F10\n\
snippet K_SHIFT_F10\n\
	K_SHIFT_F10 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_F10\n\
snippet K_CTRL_ALT_F10\n\
	K_CTRL_ALT_F10 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_F10\n\
snippet K_CTRL_SHIFT_F10\n\
	K_CTRL_SHIFT_F10 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_F10\n\
snippet K_CTRL_ALT_SHIFT_F10\n\
	K_CTRL_ALT_SHIFT_F10 -> { ${1://cuerpo...} }\n\
\n\
# K_F11\n\
snippet K_F11\n\
	K_F11 -> { ${1://cuerpo...} }\n\
# K_CTRL_F11\n\
snippet K_CTRL_F11\n\
	K_CTRL_F11 -> { ${1://cuerpo...} }\n\
# K_ALT_F11\n\
snippet K_ALT_F11\n\
	K_ALT_F11 -> { ${1://cuerpo...} }\n\
# K_SHIFT_F11\n\
snippet K_SHIFT_F11\n\
	K_SHIFT_F11 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_F11\n\
snippet K_CTRL_ALT_F11\n\
	K_CTRL_ALT_F11 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_F11\n\
snippet K_CTRL_SHIFT_F11\n\
	K_CTRL_SHIFT_F11 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_F11\n\
snippet K_CTRL_ALT_SHIFT_F11\n\
	K_CTRL_ALT_SHIFT_F11 -> { ${1://cuerpo...} }\n\
\n\
# K_F12\n\
snippet K_F12\n\
	K_F12 -> { ${1://cuerpo...} }\n\
# K_CTRL_F12\n\
snippet K_CTRL_F12\n\
	K_CTRL_F12 -> { ${1://cuerpo...} }\n\
# K_ALT_F12\n\
snippet K_ALT_F12\n\
	K_ALT_F12 -> { ${1://cuerpo...} }\n\
# K_SHIFT_F12\n\
snippet K_SHIFT_F12\n\
	K_SHIFT_F12 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_F12\n\
snippet K_CTRL_ALT_F12\n\
	K_CTRL_ALT_F12 -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_F12\n\
snippet K_CTRL_SHIFT_F12\n\
	K_CTRL_SHIFT_F12 -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_F12\n\
snippet K_CTRL_ALT_SHIFT_F12\n\
	K_CTRL_ALT_SHIFT_F12 -> { ${1://cuerpo...} }\n\
\n\
# K_RETURN\n\
snippet K_RETURN\n\
	K_RETURN -> { ${1://cuerpo...} }\n\
# K_CTRL_RETURN\n\
snippet K_CTRL_RETURN\n\
	K_CTRL_RETURN -> { ${1://cuerpo...} }\n\
# K_ALT_RETURN\n\
snippet K_ALT_RETURN\n\
	K_ALT_RETURN -> { ${1://cuerpo...} }\n\
# K_SHIFT_RETURN\n\
snippet K_SHIFT_RETURN\n\
	K_SHIFT_RETURN -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_RETURN\n\
snippet K_CTRL_ALT_RETURN\n\
	K_CTRL_ALT_RETURN -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_RETURN\n\
snippet K_CTRL_SHIFT_RETURN\n\
	K_CTRL_SHIFT_RETURN -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_RETURN\n\
snippet K_CTRL_ALT_SHIFT_RETURN\n\
	K_CTRL_ALT_SHIFT_RETURN -> { ${1://cuerpo...} }\n\
\n\
# K_SPACE\n\
snippet K_SPACE\n\
	K_SPACE -> { ${1://cuerpo...} }\n\
# K_CTRL_SPACE\n\
snippet K_CTRL_SPACE\n\
	K_CTRL_SPACE -> { ${1://cuerpo...} }\n\
# K_ALT_SPACE\n\
snippet K_ALT_SPACE\n\
	K_ALT_SPACE -> { ${1://cuerpo...} }\n\
# K_SHIFT_SPACE\n\
snippet K_SHIFT_SPACE\n\
	K_SHIFT_SPACE -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SPACE\n\
snippet K_CTRL_ALT_SPACE\n\
	K_CTRL_ALT_SPACE -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_SPACE\n\
snippet K_CTRL_SHIFT_SPACE\n\
	K_CTRL_SHIFT_SPACE -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_SPACE\n\
snippet K_CTRL_ALT_SHIFT_SPACE\n\
	K_CTRL_ALT_SHIFT_SPACE -> { ${1://cuerpo...} }\n\
\n\
# K_ESCAPE\n\
snippet K_ESCAPE\n\
	K_ESCAPE -> { ${1://cuerpo...} }\n\
# K_CTRL_ESCAPE\n\
snippet K_CTRL_ESCAPE\n\
	K_CTRL_ESCAPE -> { ${1://cuerpo...} }\n\
# K_ALT_ESCAPE\n\
snippet K_ALT_ESCAPE\n\
	K_ALT_ESCAPE -> { ${1://cuerpo...} }\n\
# K_SHIFT_ESCAPE\n\
snippet K_SHIFT_ESCAPE\n\
	K_SHIFT_ESCAPE -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_ESCAPE\n\
snippet K_CTRL_ALT_ESCAPE\n\
	K_CTRL_ALT_ESCAPE -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_ESCAPE\n\
snippet K_CTRL_SHIFT_ESCAPE\n\
	K_CTRL_SHIFT_ESCAPE -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_ESCAPE\n\
snippet K_CTRL_ALT_SHIFT_ESCAPE\n\
	K_CTRL_ALT_SHIFT_ESCAPE -> { ${1://cuerpo...} }\n\
\n\
# K_BACKSPACE\n\
snippet K_BACKSPACE\n\
	K_BACKSPACE -> { ${1://cuerpo...} }\n\
# K_CTRL_BACKSPACE\n\
snippet K_CTRL_BACKSPACE\n\
	K_CTRL_BACKSPACE -> { ${1://cuerpo...} }\n\
# K_ALT_BACKSPACE\n\
snippet K_ALT_BACKSPACE\n\
	K_ALT_BACKSPACE -> { ${1://cuerpo...} }\n\
# K_SHIFT_BACKSPACE\n\
snippet K_SHIFT_BACKSPACE\n\
	K_SHIFT_BACKSPACE -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_BACKSPACE\n\
snippet K_CTRL_ALT_BACKSPACE\n\
	K_CTRL_ALT_BACKSPACE -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_BACKSPACE\n\
snippet K_CTRL_SHIFT_BACKSPACE\n\
	K_CTRL_SHIFT_BACKSPACE -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_BACKSPACE\n\
snippet K_CTRL_ALT_SHIFT_BACKSPACE\n\
	K_CTRL_ALT_SHIFT_BACKSPACE -> { ${1://cuerpo...} }\n\
\n\
# K_TAB\n\
snippet K_TAB\n\
	K_TAB -> { ${1://cuerpo...} }\n\
# K_CTRL_TAB\n\
snippet K_CTRL_TAB\n\
	K_CTRL_TAB -> { ${1://cuerpo...} }\n\
# K_ALT_TAB\n\
snippet K_ALT_TAB\n\
	K_ALT_TAB -> { ${1://cuerpo...} }\n\
# K_SHIFT_TAB\n\
snippet K_SHIFT_TAB\n\
	K_SHIFT_TAB -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_TAB\n\
snippet K_CTRL_ALT_TAB\n\
	K_CTRL_ALT_TAB -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_TAB\n\
snippet K_CTRL_SHIFT_TAB\n\
	K_CTRL_SHIFT_TAB -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_TAB\n\
snippet K_CTRL_ALT_SHIFT_TAB\n\
	K_CTRL_ALT_SHIFT_TAB -> { ${1://cuerpo...} }\n\
\n\
# K_UP\n\
snippet K_UP\n\
	K_UP -> { ${1://cuerpo...} }\n\
# K_CTRL_UP\n\
snippet K_CTRL_UP\n\
	K_CTRL_UP -> { ${1://cuerpo...} }\n\
# K_ALT_UP\n\
snippet K_ALT_UP\n\
	K_ALT_UP -> { ${1://cuerpo...} }\n\
# K_SHIFT_UP\n\
snippet K_SHIFT_UP\n\
	K_SHIFT_UP -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_UP\n\
snippet K_CTRL_ALT_UP\n\
	K_CTRL_ALT_UP -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_UP\n\
snippet K_CTRL_SHIFT_UP\n\
	K_CTRL_SHIFT_UP -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_UP\n\
snippet K_CTRL_ALT_SHIFT_UP\n\
	K_CTRL_ALT_SHIFT_UP -> { ${1://cuerpo...} }\n\
\n\
# K_DOWN\n\
snippet K_DOWN\n\
	K_DOWN -> { ${1://cuerpo...} }\n\
# K_CTRL_DOWN\n\
snippet K_CTRL_DOWN\n\
	K_CTRL_DOWN -> { ${1://cuerpo...} }\n\
# K_ALT_DOWN\n\
snippet K_ALT_DOWN\n\
	K_ALT_DOWN -> { ${1://cuerpo...} }\n\
# K_SHIFT_DOWN\n\
snippet K_SHIFT_DOWN\n\
	K_SHIFT_DOWN -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_DOWN\n\
snippet K_CTRL_ALT_DOWN\n\
	K_CTRL_ALT_DOWN -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_DOWN\n\
snippet K_CTRL_SHIFT_DOWN\n\
	K_CTRL_SHIFT_DOWN -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_DOWN\n\
snippet K_CTRL_ALT_SHIFT_DOWN\n\
	K_CTRL_ALT_SHIFT_DOWN -> { ${1://cuerpo...} }\n\
\n\
# K_LEFT\n\
snippet K_LEFT\n\
	K_LEFT -> { ${1://cuerpo...} }\n\
# K_CTRL_LEFT\n\
snippet K_CTRL_LEFT\n\
	K_CTRL_LEFT -> { ${1://cuerpo...} }\n\
# K_ALT_LEFT\n\
snippet K_ALT_LEFT\n\
	K_ALT_LEFT -> { ${1://cuerpo...} }\n\
# K_SHIFT_LEFT\n\
snippet K_SHIFT_LEFT\n\
	K_SHIFT_LEFT -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_LEFT\n\
snippet K_CTRL_ALT_LEFT\n\
	K_CTRL_ALT_LEFT -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_LEFT\n\
snippet K_CTRL_SHIFT_LEFT\n\
	K_CTRL_SHIFT_LEFT -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_LEFT\n\
snippet K_CTRL_ALT_SHIFT_LEFT\n\
	K_CTRL_ALT_SHIFT_LEFT -> { ${1://cuerpo...} }\n\
\n\
# K_RIGHT\n\
snippet K_RIGHT\n\
	K_RIGHT -> { ${1://cuerpo...} }\n\
# K_CTRL_RIGHT\n\
snippet K_CTRL_RIGHT\n\
	K_CTRL_RIGHT -> { ${1://cuerpo...} }\n\
# K_ALT_RIGHT\n\
snippet K_ALT_RIGHT\n\
	K_ALT_RIGHT -> { ${1://cuerpo...} }\n\
# K_SHIFT_RIGHT\n\
snippet K_SHIFT_RIGHT\n\
	K_SHIFT_RIGHT -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_RIGHT\n\
snippet K_CTRL_ALT_RIGHT\n\
	K_CTRL_ALT_RIGHT -> { ${1://cuerpo...} }\n\
# K_CTRL_SHIFT_RIGHT\n\
snippet K_CTRL_SHIFT_RIGHT\n\
	K_CTRL_SHIFT_RIGHT -> { ${1://cuerpo...} }\n\
# K_CTRL_ALT_SHIFT_RIGHT\n\
snippet K_CTRL_ALT_SHIFT_RIGHT\n\
	K_CTRL_ALT_SHIFT_RIGHT -> { ${1://cuerpo...} }\n\
\n\
# recorrido (simple)\n\
snippet recorrido (simple)\n\
	${1:// Ir al inicio}\n\
	while (not ${2:// es último elemento}) {\n\
		${3:// Procesar el elemento}\n\
		${4:// Ir al próximo elemento}\n\
	}\n\
	${5:// Finalizar}\n\
\n\
# recorrido (de acumulación)\n\
snippet recorrido (de acumulación)\n\
	${1:// Ir al inicio}\n\
	${2:cantidadVistos} := ${3:// contar elementos en lugar actual}\n\
	while (not ${4:// es último elemento}) {\n\
		${4:// Ir al próximo elemento}\n\
		${2:cantidadVistos} := ${2:cantidadVistos} + ${3:// contar elementos en lugar actual}\n\
	}\n\
	return (${2:cantidadVistos})\n\
\n\
# recorrido (de búsqueda)\n\
snippet recorrido (de búsqueda)\n\
	${1:// Ir al inicio}\n\
	while (not ${2:// encontré lo que buscaba}) {\n\
		${3:// Ir al próximo elemento}\n\
	}\n\
	return (${2:// encontré lo que buscaba })\n\
\n\
# recorrido (de búsqueda con borde)\n\
snippet recorrido (de búsqueda con borde)\n\
	${1:// Ir al inicio}\n\
	while (not ${2:// encontré lo que buscaba} && not ${3:// es último elemento}) {\n\
		${4:// Ir al próximo elemento}\n\
	}\n\
	return (${2:// encontré lo que buscaba })\n\
\n\
# recorrido (de tipos enumerativos)\n\
snippet recorrido (de tipos enumerativos)\n\
	${1:elementoActual} := ${2:minElemento()}\n\
	while (${1:elementoActual} /= ${3:maxElemento()}) {\n\
		${4:// Procesar con elemento actual}\n\
		${1:elementoActual} := siguiente(${1:elementoActual})\n\
	}\n\
	${4:// Procesar con elemento actual}\n\
\n\
# recorrido (de búsqueda sobre lista)\n\
snippet recorrido (de búsqueda sobre lista)\n\
	${1:listaRecorrida} := ${2:lista}\n\
	while (primero(${1:listaRecorrida}) /= ${3://elemento buscado}) {\n\
		${1:elementoActual} := sinElPrimero(${1:elementoActual})\n\
	}\n\
	return (primero(${1:listaRecorrida}))\n\
\n\
# recorrido (de búsqueda sobre lista con borde)\n\
snippet recorrido (de búsqueda sobre lista con borde)\n\
	${1:listaRecorrida} := ${2:lista}\n\
	while (not esVacía(${1:listaRecorrida}) && primero(${1:listaRecorrida}) /= ${3://elemento buscado}) {\n\
		${1:elementoActual} := sinElPrimero(${1:elementoActual})\n\
	}\n\
	return (not esVacía(${1:listaRecorrida}))\n\
\n\
# docs (procedimiento)\n\
snippet docs (procedimiento)\n\
	/*\n\
		@PROPÓSITO: ${1:...}\n\
		@PRECONDICIÓN: ${2:...}\n\
	*/\n\
\n\
# docs (procedimiento con parámetros)\n\
snippet docs (procedimiento con parámetros)\n\
	/*\n\
		@PROPÓSITO: ${1:...}\n\
		@PRECONDICIÓN: ${2:...}\n\
		@PARÁMETROS:\n\
				* ${3:nombreDelParámetro} : ${4:Tipo} - ${5:descripción}\n\
	*/\n\
\n\
# docs (función)\n\
snippet docs (función)\n\
	/*\n\
		@PROPÓSITO: ${1:...}\n\
		@PRECONDICIÓN: ${2:...}\n\
		@TIPO: ${3:...}\n\
	*/\n\
\n\
# docs (función con parámetros)\n\
snippet docs (función con parámetros)\n\
	/*\n\
		@PROPÓSITO: ${1:...}\n\
		@PRECONDICIÓN: ${2:...}\n\
		@PARÁMETROS:\n\
				* ${3:nombreDelParámetro} : ${4:Tipo} - ${5:descripción}\n\
		@TIPO: ${6:...}\n\
	*/\n\
";
exports.scope = "gobstones";

});                (function() {
                    ace.require(["ace/snippets/gobstones"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            