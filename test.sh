echo -e "\n\n Remove any existing test MFA codes directory"
rm -rf ~/mfa_codes_testing

echo -e "\n\nRemove any existing test QR codes directory"
rm -rf ~/qr_codes_testing


echo -e "\n\nshould work with error - empty dir"
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/qr_codes_testing


cp ~/qr_codes/1.jpg ~/qr_codes_testing/1.jpg

echo -e "\n\nShould import new codes"
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/qr_codes_testing


cp ~/qr_codes/2.jpg ~/qr_codes_testing/2.jpg

echo -e "\n\nShould do nothing and only show existing ones"
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/qr_codes_testing

echo -e "\n\nShould add new ones"
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/qr_codes_testing -q

echo -e "\n\nShould add new ones and ask for deleting old - non in this case"
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/qr_codes_testing -q --overwrite

echo -e "\n\nShould ask to delete old - many in this case"
rm -rf ~/qr_codes_testing/1.jpg
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/qr_codes_testing -q --overwrite

cp ~/qr_codes/1.jpg ~/qr_codes_testing/1.jpg
cp ~/qr_codes/2.jpg ~/qr_codes_testing/2.jpg
cp ~/qr_codes/3.jpg ~/qr_codes_testing/3.jpg

echo -e "\n\nShould add new ones only."
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/qr_codes_testing -q --overwrite

echo -e "\n\nShould show only one code to console"
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/qr_codes_testing nikola

echo -e "\n\nShould show many codes to console"
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/qr_codes_testing aws --multiple

echo -e "\n\nShould copy to clipboard"
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/qr_codes_testing nikola --copy
