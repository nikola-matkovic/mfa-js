

rm -rf ~/mfa_codes_testing
rm -rf ~/~/qr_codes_testing


# should work with error - empty dir
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/~/qr_codes_testing


cp ~/qr_codes/1.jpg ~/qr_codes_testing/1.jpg

# Should import new codes
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/~/qr_codes_testing


cp ~/qr_codes/2.jpg ~/qr_codes_testing/2.jpg

# Should do nothing and only show existing ones
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/~/qr_codes_testing

# Should add new ones
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/~/qr_codes_testing -q

# Should add new ones and ask for deleting old - non in this case
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/~/qr_codes_testing -q --overwrite

# Should ask to delete old - many in this case
rm -rf ~/~/qr_codes_testing/1.jpg
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/~/qr_codes_testing -q --overwrite

cp ~/qr_codes/1.jpg ~/qr_codes_testing/1.jpg
cp ~/qr_codes/2.jpg ~/qr_codes_testing/2.jpg

# Should add new ones only.
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/~/qr_codes_testing -q --overwrite

# Should show only one code to console
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/~/qr_codes_testing nikola

# Should show many codes to console
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/~/qr_codes_testing aws --multiple

# Should copy to clipboard
node index.js --mfa-path ~/mfa_codes_testing --qrcodes-path ~/~/qr_codes_testing nikola --copy
