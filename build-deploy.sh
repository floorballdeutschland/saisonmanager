#!/bin/bash
ng build
scp -r dist/saisonmanager/browser/* saisonmanager.de:/var/www/saisonmanager/
