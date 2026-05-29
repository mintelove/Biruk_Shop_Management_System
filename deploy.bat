@echo off
set GIT="C:\Program Files\Git\bin\git.exe"

echo === Adding safe directory ===
%GIT% config --global --add safe.directory "C:/Users/MaM App Studio/Documents/Biruk_Shop_Management_System"

echo === Configuring user ===
%GIT% config user.email "mamappstudio0@gmail.com"
%GIT% config user.name "mintelove"

echo === Re-initializing repo ===
%GIT% init

echo === Setting branch to main ===
%GIT% branch -M main

echo === Adding remote ===
%GIT% remote remove origin 2>nul
%GIT% remote add origin https://github.com/mintelove/Biruk_Shop_Management_System.git

echo === Staging all files ===
%GIT% add -A

echo === Git status ===
%GIT% status

echo === Committing ===
%GIT% commit -m "feat: connect backend to MongoDB Atlas with DNS fallback patch"

echo === Pushing to GitHub ===
%GIT% push -u origin main

echo === Done ===
