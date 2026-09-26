import type { Language } from "@/i18n/translations";

const testLabelTranslations: Record<string, Partial<Record<Language, string>>> = {
  control_pass_video: { en: "Control & Pass", de: "Kontrolle & Pass", fr: "Contrôle et passe", es: "Control y pase", it: "Controllo e passaggio" },
  slalom_video: { en: "Cone Slalom", de: "Hütchen-Slalom", fr: "Slalom entre plots", es: "Slalom entre conos", it: "Slalom tra i coni" },
  precision_video: { en: "Precision", de: "Präzision", fr: "Précision", es: "Precisión", it: "Precisione" },
  coordination_video: { en: "Coordination", de: "Koordination", fr: "Coordination", es: "Coordinación", it: "Coordinazione" },
  long_pass_video: { en: "Long Pass to a Fixed Point", de: "Langer Pass auf einen festen Punkt", fr: "Passe longue sur point fixe", es: "Pase largo a punto fijo", it: "Passaggio lungo su punto fisso" },
};

const testDescriptionTranslations: Record<string, Partial<Record<Language, string>>> = {
  speed: {
    en: "Setup: The player starts at the first mark at the bottom of the free-throw lane (the key).\n\nExercise: Run forward to the edge of the free-throw circle, then perform a lateral slide across to the other side, level with the lane line. Then backpedal to the first mark of the lane, followed by a lateral slide touching the line with the foot, and a lateral slide back to return exactly to the starting position. The total execution time is measured.",
    de: "Aufbau: Der Spieler startet an der ersten Markierung am unteren Ende der Freiwurfzone.\n\nÜbung: Lauf nach vorne bis zum Rand des Freiwurfkreises, dann seitliches Sliden zur anderen Seite, auf Höhe der Zonenlinie. Danach rückwärts laufen bis zur ersten Markierung der Zone, gefolgt von einem seitlichen Sliden, bei dem die Linie mit dem Fuß berührt wird, und einem seitlichen Sliden zurück bis zur exakten Ausgangsposition. Die Gesamtzeit wird gemessen.",
    fr: "Configuration : Le joueur se place au premier repère, au bas de la raquette.\n\nExercice : Course avant jusqu'au bord du cercle des lancers francs, puis glissade latérale jusqu'à l'autre côté, au niveau de la ligne de la raquette. Ensuite, course arrière jusqu'au premier repère de la raquette, suivie d'une glissade latérale en touchant la ligne du pied, puis d'une glissade latérale retour jusqu'à la position de départ exacte. Le temps total d'exécution est chronométré.",
    es: "Configuración: El jugador se coloca en la primera marca, en la base de la zona.\n\nEjercicio: Carrera hacia adelante hasta el borde del círculo de tiros libres, luego deslizamiento lateral hasta el otro lado, a la altura de la línea de la zona. A continuación, carrera hacia atrás hasta la primera marca de la zona, seguida de un deslizamiento lateral tocando la línea con el pie, y un deslizamiento lateral de vuelta hasta regresar exactamente a la posición inicial. Se cronometra el tiempo total de ejecución.",
    it: "Configurazione: Il giocatore si posiziona al primo segno, alla base dell'area dei tre secondi.\n\nEsercizio: Corsa in avanti fino al bordo del cerchio del tiro libero, poi scivolamento laterale fino all'altro lato, all'altezza della linea dell'area. Segue una corsa all'indietro fino al primo segno dell'area, quindi uno scivolamento laterale toccando la linea con il piede, e uno scivolamento laterale di ritorno fino a tornare esattamente nella posizione di partenza. Viene cronometrato il tempo totale di esecuzione.",
  },
  jumping: {
    en: "Setup: The athlete stands with feet together, next to a wall or a jump-measuring device.\n\nExercise: From a static position, using both feet, the athlete jumps vertically as high as possible. The jump height is measured.",
    de: "Aufbau: Der Sportler steht mit geschlossenen Füßen neben einer Wand oder einem Sprungmessgerät.\n\nÜbung: Aus dem Stand springt der Sportler mit beiden Füßen so hoch wie möglich senkrecht nach oben. Die Sprunghöhe wird gemessen.",
    fr: "Configuration : L'athlète se positionne pieds joints, près d'un mur ou d'un dispositif de mesure de saut.\n\nExercice : Depuis une position statique, avec les deux pieds, l'athlète saute verticalement le plus haut possible. La hauteur du saut est mesurée.",
    es: "Configuración: El deportista se coloca con los pies juntos, junto a una pared o un dispositivo de medición de salto.\n\nEjercicio: Desde una posición estática, con ambos pies, el deportista salta verticalmente lo más alto posible. Se mide la altura del salto.",
    it: "Configurazione: L'atleta si posiziona con i piedi uniti, vicino a un muro o a un dispositivo di misurazione del salto.\n\nEsercizio: Da posizione statica, con entrambi i piedi, l'atleta salta verticalmente il più in alto possibile. Viene misurata l'altezza del salto.",
  },
  endurance: {
    en: "Setup: On a basketball court. The player positions themselves at the middle of the free-throw lane (the key).\n\nExercise: On the whistle, the player moves laterally to one line of the lane, touching it with the foot, then turns and runs to the other line of the lane. The movement is repeated several times, at maximum speed, changing direction at each line. The total time is measured.",
    de: "Aufbau: Auf dem Basketballfeld. Der Spieler positioniert sich in der Mitte der Freiwurfzone.\n\nÜbung: Beim Pfiff bewegt sich der Spieler seitlich zu einer Linie der Zone, berührt sie mit dem Fuß, dreht sich dann um und läuft zur anderen Linie der Zone. Die Bewegung wird mehrmals wiederholt, mit maximaler Geschwindigkeit, wobei bei jeder Linie die Richtung gewechselt wird. Die Gesamtzeit wird gemessen.",
    fr: "Configuration : Sur un terrain de basket-ball. Le joueur se positionne au milieu de la raquette.\n\nExercice : Au coup de sifflet, le joueur se déplace latéralement jusqu'à une ligne de la raquette, la touche du pied, puis se retourne et court vers l'autre ligne de la raquette. Le mouvement se répète plusieurs fois, à vitesse maximale, en changeant de direction à chaque ligne. Le temps total est chronométré.",
    es: "Configuración: En una cancha de baloncesto. El jugador se coloca en el centro de la zona.\n\nEjercicio: Al silbato, el jugador se desplaza lateralmente hasta una línea de la zona, tocándola con el pie, y luego se da la vuelta y corre hacia la otra línea de la zona. El movimiento se repite varias veces, a velocidad máxima, cambiando de dirección en cada línea. Se cronometra el tiempo total.",
    it: "Configurazione: Su un campo da basket. Il giocatore si posiziona al centro dell'area dei tre secondi.\n\nEsercizio: Al fischio, il giocatore si sposta lateralmente fino a una linea dell'area, toccandola con il piede, poi si gira e corre verso l'altra linea dell'area. Il movimento si ripete più volte, alla massima velocità, cambiando direzione a ogni linea. Viene cronometrato il tempo totale.",
  },
  acceleration: {
    en: "Setup: Similar to the vertical jump, but preceded by a short run-up (3-5 meters).\n\nExercise: The athlete performs a short run-up, then jumps vertically with both feet as high as possible. The jump height from motion is measured.",
    de: "Aufbau: Ähnlich wie der vertikale Sprung, jedoch mit einem kurzen Anlauf (3-5 Meter) davor.\n\nÜbung: Der Sportler führt einen kurzen Anlauf aus und springt dann mit beiden Füßen so hoch wie möglich senkrecht nach oben. Die Sprunghöhe aus der Bewegung wird gemessen.",
    fr: "Configuration : Similaire au saut vertical, mais précédé d'une courte course d'élan (3 à 5 mètres).\n\nExercice : L'athlète effectue une courte course d'élan, puis saute verticalement avec les deux pieds le plus haut possible. La hauteur du saut en mouvement est mesurée.",
    es: "Configuración: Similar al salto vertical, pero precedido de una carrera corta de impulso (3-5 metros).\n\nEjercicio: El deportista realiza una breve carrera de impulso y luego salta verticalmente con ambos pies lo más alto posible. Se mide la altura del salto en movimiento.",
    it: "Configurazione: Simile al salto verticale, ma preceduto da una breve rincorsa (3-5 metri).\n\nEsercizio: L'atleta esegue una breve rincorsa, poi salta verticalmente con entrambi i piedi il più in alto possibile. Viene misurata l'altezza del salto in movimento.",
  },
  straight_line_speed: {
    en: "Setup: The standard distance is 22 meters — on a basketball court, this is the path from the baseline to the free-throw line at the opposite end of the court.\n\nFor football, no pitch line sits at exactly 22 m (pitch dimensions vary), but the distance can be credibly reconstructed from two official markings that are fixed on every pitch: the edge of the penalty area (16.5 m from the goal line) + the depth of the goal area (5.5 m) = exactly 22 m. Place the start cone at the edge of the penalty area, and the finish cone 5.5 m beyond it (the same depth as the goal area, visible on the pitch as a reference).\n\nExercise: The athlete starts from a static position and sprints at maximum speed, in a straight line, to the finish line. The time is measured to evaluate long-distance sprint speed.",
    de: "Aufbau: Die Standarddistanz beträgt 22 Meter — auf dem Basketballfeld entspricht dies der Strecke von der Grundlinie bis zur Freiwurflinie am gegenüberliegenden Ende des Feldes.\n\nIm Fußball liegt keine Linie exakt bei 22 m (die Feldmaße variieren), aber die Distanz lässt sich glaubwürdig aus zwei offiziellen, auf jedem Feld fixen Markierungen zusammensetzen: die Strafraumlinie (16,5 m vom Tor) + die Tiefe des Torraums (5,5 m) = genau 22 m. Der Starthütchen wird an die Strafraumlinie gestellt, das Ziel-Hütchen 5,5 m dahinter (dieselbe Tiefe wie der Torraum, auf dem Feld als Referenz sichtbar).\n\nÜbung: Der Sportler startet aus einer statischen Position und sprintet mit maximaler Geschwindigkeit in gerader Linie bis zur Ziellinie. Die Zeit wird gemessen, um die Sprintgeschwindigkeit über eine lange Distanz zu bewerten.",
    fr: "Configuration : La distance standard est de 22 mètres — sur un terrain de basket-ball, cela correspond au trajet de la ligne de fond à la ligne des lancers francs à l'extrémité opposée du terrain.\n\nEn football, aucune ligne du terrain ne se situe exactement à 22 m (les dimensions des terrains varient), mais la distance peut être reconstituée de façon crédible à partir de deux repères officiels, fixes sur tous les terrains : la limite de la surface de réparation (16,5 m de la ligne de but) + la profondeur de la surface de but (5,5 m) = exactement 22 m. Le plot de départ se place à la limite de la surface de réparation, celui d'arrivée 5,5 m plus loin (la même profondeur que la surface de but, visible sur le terrain comme repère).\n\nExercice : L'athlète part d'une position statique et sprinte à vitesse maximale, en ligne droite, jusqu'à la ligne d'arrivée. Le temps est chronométré pour évaluer la vitesse de sprint sur longue distance.",
    es: "Configuración: La distancia estándar es de 22 metros — en una cancha de baloncesto, corresponde al trayecto desde la línea de fondo hasta la línea de tiros libres del extremo opuesto de la cancha.\n\nEn fútbol, ninguna línea del campo está exactamente a 22 m (las dimensiones del campo varían), pero la distancia puede reconstruirse de forma creíble con dos referencias oficiales, fijas en cualquier campo: el borde del área grande (16,5 m de la línea de meta) + la profundidad del área pequeña (5,5 m) = exactamente 22 m. El cono de salida se coloca en el borde del área grande, y el de llegada 5,5 m más allá (la misma profundidad que el área pequeña, visible en el campo como referencia).\n\nEjercicio: El deportista parte de una posición estática y esprinta a velocidad máxima, en línea recta, hasta la línea de meta. Se cronometra el tiempo para evaluar la velocidad de esprint en distancia larga.",
    it: "Configurazione: La distanza standard è di 22 metri — su un campo da basket, corrisponde al percorso dalla linea di fondo alla linea del tiro libero all'estremità opposta del campo.\n\nNel calcio, nessuna linea del campo si trova esattamente a 22 m (le dimensioni del campo variano), ma la distanza può essere ricostruita in modo credibile da due riferimenti ufficiali, fissi su ogni campo: il limite dell'area di rigore (16,5 m dalla linea di porta) + la profondità dell'area di porta (5,5 m) = esattamente 22 m. Il cono di partenza si posiziona al limite dell'area di rigore, quello di arrivo 5,5 m oltre (la stessa profondità dell'area di porta, visibile sul campo come riferimento).\n\nEsercizio: L'atleta parte da una posizione statica e sprinta alla massima velocità, in linea retta, fino al traguardo. Il tempo viene cronometrato per valutare la velocità di sprint su lunga distanza.",
  },
  free_throw_shooting_video: {
    en: "Setup: The player stands at the free-throw line.\n\nExercise: For 60 seconds, the athlete shoots, retrieves their own ball, and returns to the free-throw line for another shot. The number of made shots is counted.",
    de: "Aufbau: Der Spieler stellt sich an die Freiwurflinie.\n\nÜbung: 60 Sekunden lang wirft der Sportler, holt sich selbst den Ball zurück und kehrt zur Freiwurflinie für den nächsten Wurf zurück. Die Anzahl der getroffenen Würfe wird gezählt.",
    fr: "Configuration : Le joueur se positionne à la ligne des lancers francs.\n\nExercice : Pendant 60 secondes, l'athlète tire, récupère lui-même son ballon et revient à la ligne des lancers francs pour un nouveau tir. Le nombre de tirs réussis est compté.",
    es: "Configuración: El jugador se coloca en la línea de tiros libres.\n\nEjercicio: Durante 60 segundos, el deportista lanza, recupera él mismo el balón y vuelve a la línea de tiros libres para un nuevo lanzamiento. Se cuentan los tiros convertidos.",
    it: "Configurazione: Il giocatore si posiziona sulla linea del tiro libero.\n\nEsercizio: Per 60 secondi, l'atleta tira, recupera da solo il pallone e torna alla linea del tiro libero per un nuovo tiro. Vengono contati i tiri realizzati.",
  },
  star_shooting_drill_video: {
    en: "Setup: 5 shooting spots marked on the court: right corner, left wing, right wing, left corner, and top of the key.\n\nExercise: 25 shots – 5 from each spot. After each shot, the player must change position. The exercise is not timed.",
    de: "Aufbau: 5 Wurfpunkte auf dem Feld markiert: rechte Ecke, linker Flügel, rechter Flügel, linke Ecke und Freiwurflinienmitte.\n\nÜbung: 25 Würfe – je 5 von jedem Punkt. Nach jedem Wurf muss der Spieler die Position wechseln. Die Übung wird nicht gestoppt.",
    fr: "Configuration : 5 points de tir marqués sur le terrain : coin droit, aile gauche, aile droite, coin gauche et sommet de la raquette.\n\nExercice : 25 tirs – 5 depuis chaque point. Après chaque tir, le joueur doit changer de position. L'exercice n'est pas chronométré.",
    es: "Configuración: 5 puntos de lanzamiento marcados en la cancha: esquina derecha, ala izquierda, ala derecha, esquina izquierda y parte superior de la zona.\n\nEjercicio: 25 lanzamientos – 5 desde cada punto. Después de cada lanzamiento, el jugador debe cambiar de posición. El ejercicio no se cronometra.",
    it: "Configurazione: 5 punti di tiro segnati sul campo: angolo destro, ala sinistra, ala destra, angolo sinistro e vertice dell'area.\n\nEsercizio: 25 tiri – 5 da ogni punto. Dopo ogni tiro, il giocatore deve cambiare posizione. L'esercizio non è cronometrato.",
  },
  crossover_video: {
    en: "Setup: 6 cones, 3 on the right side and 3 on the left, 2 meters apart.\n\nExercise: Perform the crossover move at maximum speed, changing direction at each cone.",
    de: "Aufbau: 6 Hütchen, 3 auf der rechten und 3 auf der linken Seite, im Abstand von 2 Metern.\n\nÜbung: Den Crossover mit maximaler Geschwindigkeit ausführen und bei jedem Hütchen die Richtung wechseln.",
    fr: "Configuration : 6 plots, 3 du côté droit et 3 du côté gauche, espacés de 2 mètres.\n\nExercice : Exécuter le crossover à vitesse maximale, en changeant de direction à chaque plot.",
    es: "Configuración: 6 conos, 3 en el lado derecho y 3 en el izquierdo, separados 2 metros.\n\nEjercicio: Ejecutar el crossover a velocidad máxima, cambiando de dirección en cada cono.",
    it: "Configurazione: 6 coni, 3 sul lato destro e 3 sul lato sinistro, a una distanza di 2 metri l'uno dall'altro.\n\nEsercizio: Eseguire il crossover alla massima velocità, cambiando direzione a ogni cono.",
  },
  between_the_legs_video: {
    en: "Setup: 6 cones, 3 on the right side and 3 on the left, 2 meters apart.\n\nExercise: Perform the between-the-legs dribble at maximum speed, changing direction at each cone.",
    de: "Aufbau: 6 Hütchen, 3 auf der rechten und 3 auf der linken Seite, im Abstand von 2 Metern.\n\nÜbung: Den Ball mit maximaler Geschwindigkeit zwischen den Beinen hindurchführen und bei jedem Hütchen die Richtung wechseln.",
    fr: "Configuration : 6 plots, 3 du côté droit et 3 du côté gauche, espacés de 2 mètres.\n\nExercice : Exécuter le dribble entre les jambes à vitesse maximale, en changeant de direction à chaque plot.",
    es: "Configuración: 6 conos, 3 en el lado derecho y 3 en el izquierdo, separados 2 metros.\n\nEjercicio: Ejecutar el bote entre las piernas a velocidad máxima, cambiando de dirección en cada cono.",
    it: "Configurazione: 6 coni, 3 sul lato destro e 3 sul lato sinistro, a una distanza di 2 metri l'uno dall'altro.\n\nEsercizio: Eseguire il palleggio tra le gambe alla massima velocità, cambiando direzione a ogni cono.",
  },
  double_cross_video: {
    en: "Setup: 5 cones in a straight line, 3 meters apart.\n\nExercise: Perform the double-crossover move every time the player reaches a cone.",
    de: "Aufbau: 5 Hütchen in einer geraden Linie, im Abstand von 3 Metern.\n\nÜbung: Bei jedem Hütchen einen doppelten Crossover ausführen.",
    fr: "Configuration : 5 plots alignés, espacés de 3 mètres.\n\nExercice : Exécuter un double crossover à chaque fois que le joueur arrive devant un plot.",
    es: "Configuración: 5 conos en línea recta, separados 3 metros.\n\nEjercicio: Ejecutar el doble crossover cada vez que el jugador llega a un cono.",
    it: "Configurazione: 5 coni in linea retta, a una distanza di 3 metri l'uno dall'altro.\n\nEsercizio: Eseguire il doppio crossover ogni volta che il giocatore raggiunge un cono.",
  },
  between_legs_cross_video: {
    en: "Setup: 5 cones in a straight line, 3 meters apart.\n\nExercise: Perform a between-the-legs dribble followed by a crossover every time the player reaches a cone.",
    de: "Aufbau: 5 Hütchen in einer geraden Linie, im Abstand von 3 Metern.\n\nÜbung: Bei jedem Hütchen den Ball zwischen den Beinen hindurchführen und anschließend einen Crossover ausführen.",
    fr: "Configuration : 5 plots alignés, espacés de 3 mètres.\n\nExercice : Exécuter un dribble entre les jambes suivi d'un crossover à chaque fois que le joueur arrive devant un plot.",
    es: "Configuración: 5 conos en línea recta, separados 3 metros.\n\nEjercicio: Ejecutar un bote entre las piernas seguido de un crossover cada vez que el jugador llega a un cono.",
    it: "Configurazione: 5 coni in linea retta, a una distanza di 3 metri l'uno dall'altro.\n\nEsercizio: Eseguire un palleggio tra le gambe seguito da un crossover ogni volta che il giocatore raggiunge un cono.",
  },
  control_pass_video: {
    en: "Setup: The player stands 5 meters from a wall or a partner.\n\nExercise: The player passes the ball against the wall and takes the first touch (control) to set up the next pass. The number of correct repetitions in 60 seconds is timed.",
    de: "Aufbau: Der Spieler steht 5 Meter von einer Wand oder einem Partner entfernt.\n\nÜbung: Der Spieler passt den Ball an die Wand und nimmt die erste Berührung (Ballannahme) für den nächsten Pass. Die Anzahl der korrekten Wiederholungen in 60 Sekunden wird gestoppt.",
    fr: "Configuration : Le joueur se tient à 5 mètres d'un mur ou d'un partenaire.\n\nExercice : Le joueur doit passer le ballon contre le mur et effectuer la première touche (contrôle) pour préparer la passe suivante. Le nombre de répétitions correctes en 60 secondes est chronométré.",
    es: "Configuración: El jugador se sitúa a 5 metros de una pared o un compañero.\n\nEjercicio: El jugador debe pasar el balón contra la pared y realizar el primer toque (control) para preparar el siguiente pase. Se cronometran las repeticiones correctas en 60 segundos.",
    it: "Configurazione: Il giocatore si trova a 5 metri da un muro o da un compagno.\n\nEsercizio: Il giocatore deve passare la palla contro il muro ed eseguire il primo controllo per preparare il passaggio successivo. Vengono cronometrate le ripetizioni corrette in 60 secondi.",
  },
  slalom_video: {
    en: "Setup: 6 cones placed in a straight line, 1 meter apart.\n\nExercise: The player runs the slalom back and forth as fast as possible while keeping the ball under control.\n\nFilming variants: right foot only, left foot only, and free (both feet).",
    de: "Aufbau: 6 Hütchen in einer geraden Linie im Abstand von 1 Meter.\n\nÜbung: Der Spieler durchläuft den Slalom hin und zurück so schnell wie möglich und behält dabei die Ballkontrolle.\n\nFilmvarianten: nur rechter Fuß, nur linker Fuß und frei (beide Füße).",
    fr: "Configuration : 6 plots alignés en ligne droite, espacés d'1 mètre.\n\nExercice : Le joueur effectue le slalom aller-retour le plus rapidement possible, en gardant le ballon sous contrôle.\n\nVariantes filmées : pied droit uniquement, pied gauche uniquement, et libre (les deux pieds).",
    es: "Configuración: 6 conos colocados en línea recta, separados 1 metro.\n\nEjercicio: El jugador recorre el slalom de ida y vuelta lo más rápido posible, manteniendo el balón bajo control.\n\nVariantes de grabación: solo pie derecho, solo pie izquierdo y libre (ambos pies).",
    it: "Configurazione: 6 coni disposti in linea retta, a una distanza di 1 metro l'uno dall'altro.\n\nEsercizio: Il giocatore percorre lo slalom andata e ritorno il più velocemente possibile, mantenendo il controllo della palla.\n\nVarianti di ripresa: solo piede destro, solo piede sinistro e libero (entrambi i piedi).",
  },
  precision_video: {
    en: "Setup: A standard goal (or a wall with the top/bottom corners marked). The player places the ball 16 meters out (edge of the penalty area).\n\nExercise: 5 shots with the right foot and 5 with the left foot, aiming at the marked zones (the corners).",
    de: "Aufbau: Ein Standardtor (oder eine Wand mit markierten oberen/unteren Ecken). Der Spieler platziert den Ball 16 Meter entfernt (Strafraumlinie).\n\nÜbung: 5 Schüsse mit dem rechten und 5 mit dem linken Fuß, wobei die markierten Zonen (Ecken) getroffen werden sollen.",
    fr: "Configuration : Un but standard (ou un mur avec les coins haut/bas marqués). Le joueur place le ballon à 16 mètres (ligne de la surface de réparation).\n\nExercice : 5 tirs du pied droit et 5 du pied gauche, en essayant de toucher les zones indiquées (les coins).",
    es: "Configuración: Una portería estándar (o una pared con las esquinas superior/inferior marcadas). El jugador coloca el balón a 16 metros (línea del área grande).\n\nEjercicio: 5 disparos con el pie derecho y 5 con el pie izquierdo, intentando golpear las zonas indicadas (las esquinas).",
    it: "Configurazione: Una porta standard (o un muro con gli angoli superiori/inferiori segnati). Il giocatore posiziona la palla a 16 metri (linea dell'area di rigore).\n\nEsercizio: 5 tiri con il piede destro e 5 con il piede sinistro, cercando di colpire le zone indicate (gli angoli).",
  },
  coordination_video: {
    en: "Exercise: The player must keep the ball in the air using their feet, thighs, and head.\n\nChallenge: The player must perform a specific sequence (e.g. left foot-right foot-left thigh-right thigh-head) as many times as possible without dropping the ball.",
    de: "Übung: Der Spieler muss den Ball mit Füßen, Oberschenkeln und Kopf in der Luft halten.\n\nHerausforderung: Der Spieler muss eine bestimmte Abfolge (z. B. links-rechts-linker Oberschenkel-rechter Oberschenkel-Kopf) so oft wie möglich ausführen, ohne den Ball fallen zu lassen.",
    fr: "Exercice : Le joueur doit maintenir le ballon en l'air en utilisant les pieds, les cuisses et la tête.\n\nDéfi : Le joueur doit réaliser une séquence spécifique (ex : pied gauche-pied droit-cuisse gauche-cuisse droite-tête) le plus de fois possible sans laisser tomber le ballon.",
    es: "Ejercicio: El jugador debe mantener el balón en el aire usando los pies, los muslos y la cabeza.\n\nDesafío: El jugador debe realizar una secuencia específica (p. ej.: izquierdo-derecho-muslo izquierdo-muslo derecho-cabeza) el mayor número de veces posible sin que el balón toque el suelo.",
    it: "Esercizio: Il giocatore deve mantenere la palla in aria usando i piedi, le cosce e la testa.\n\nSfida: Il giocatore deve eseguire una sequenza specifica (es. sinistro-destro-coscia sinistra-coscia destra-testa) il maggior numero di volte possibile senza far cadere la palla.",
  },
  long_pass_video: {
    en: "Setup: A circle made of cones (3-meter diameter) 30 meters from the player.\n\nExercise: 5 attempts to send the ball through the air so it lands inside the circle.\n\nFilming variants: right foot only, left foot only.",
    de: "Aufbau: Ein aus Hütchen gebildeter Kreis (3 Meter Durchmesser) in 30 Metern Entfernung vom Spieler.\n\nÜbung: 5 Versuche, den Ball durch die Luft so zu spielen, dass er im Kreis landet.\n\nFilmvarianten: nur rechter Fuß, nur linker Fuß.",
    fr: "Configuration : Un cercle formé de plots (diamètre de 3 mètres) à 30 mètres du joueur.\n\nExercice : 5 tentatives pour envoyer le ballon dans les airs afin qu'il atterrisse à l'intérieur du cercle.\n\nVariantes filmées : pied droit uniquement, pied gauche uniquement.",
    es: "Configuración: Un círculo formado por conos (3 metros de diámetro) a 30 metros del jugador.\n\nEjercicio: 5 intentos de enviar el balón por el aire para que caiga dentro del círculo.\n\nVariantes de grabación: solo pie derecho, solo pie izquierdo.",
    it: "Configurazione: Un cerchio formato da coni (diametro di 3 metri) a 30 metri dal giocatore.\n\nEsercizio: 5 tentativi di inviare la palla in aria in modo che atterri all'interno del cerchio.\n\nVarianti di ripresa: solo piede destro, solo piede sinistro.",
  },
};

export function translateTestLabel(key: string, defaultLabel: string, lang: Language): string {
  if (lang === "ro") return defaultLabel;
  return testLabelTranslations[key]?.[lang] ?? defaultLabel;
}

export function translateTestDescription(key: string, defaultDescription: string, lang: Language): string {
  if (lang === "ro") return defaultDescription;
  return testDescriptionTranslations[key]?.[lang] ?? defaultDescription;
}
