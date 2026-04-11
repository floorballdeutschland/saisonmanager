#!/bin/bash
ng build
scp -r dist/saisonmanager/browser/* saisonmanager:/opt/saisonmanager/saisonmanager-frontend/
