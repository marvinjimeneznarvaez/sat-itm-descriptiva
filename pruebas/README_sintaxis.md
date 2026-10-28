# Verificación de sintaxis sin Node.js

No hay Node en este equipo, pero Windows trae el motor de JavaScript de Windows Script Host, y
sirve para comprobar que los cinco archivos de `js/` **compilan** antes de abrir el navegador.
Es una red de seguridad barata: detecta una coma o un paréntesis de más en un segundo.

## Procedimiento

Desde `App Descriptiva/app/`:

```
python -I pruebas/comprobar_sintaxis.py
```

El script genera un archivo temporal de JScript y lo ejecuta con `cscript`.

## Advertencia sobre un falso positivo

El motor de Windows Script Host implementa ECMAScript 3, donde `catch` es palabra reservada y
`promesa.catch(...)` da un error de compilación que **no existe en ningún navegador actual**.
El comprobador sustituye `.catch(` por `['catch'](` solo para el análisis; el código del sitio no
se toca. Si aparece cualquier otro error, sí es real.
