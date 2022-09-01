#!/bin/bash
ng build
scp -r dist/saisonmanager/* saisonmanager.de:/var/www/saisonmanager/
