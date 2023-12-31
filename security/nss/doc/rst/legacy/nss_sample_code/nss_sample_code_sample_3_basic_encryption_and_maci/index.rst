.. _mozilla_projects_nss_nss_sample_code_nss_sample_code_sample_3_basic_encryption_and_maci:

NSS Sample Code Sample_3_Basic Encryption and MACing
====================================================

.. _nss_sample_code_3_basic_encryption_and_macing:

`NSS Sample Code 3: Basic Encryption and MACing <#nss_sample_code_3_basic_encryption_and_macing>`__
---------------------------------------------------------------------------------------------------

.. container::

   This example program demonstrates how to encrypt and MAC a file. 

.. _sample_code_3:

`Sample Code 3 <#sample_code_3>`__
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. container::

   .. code:: brush:

      /* NSPR Headers */
      #include <prthread.h>
      #include <plgetopt.h>
      #include <prerror.h>
      #include <prinit.h>
      #include <prlog.h>
      #include <prtypes.h>
      #include <plstr.h>

      /* NSS headers */
      #include <keyhi.h>
      #include <pk11priv.h>

      /* our samples utilities */
      #include "util.h"

      #define BUFFERSIZE            80
      #define DIGESTSIZE            16
      #define PTEXT_MAC_BUFFER_SIZE 96
      #define CIPHERSIZE            96
      #define BLOCKSIZE             32

      #define CIPHER_HEADER         "-----BEGIN CIPHER-----"
      #define CIPHER_TRAILER        "-----END CIPHER-----"
      #define ENCKEY_HEADER         "-----BEGIN AESKEY CKAID-----"
      #define ENCKEY_TRAILER        "-----END AESKEY CKAID-----"
      #define MACKEY_HEADER         "-----BEGIN MACKEY CKAID-----"
      #define MACKEY_TRAILER        "-----END MACKEY CKAID-----"
      #define IV_HEADER             "-----BEGIN IV-----"
      #define IV_TRAILER            "-----END IV-----"
      #define MAC_HEADER            "-----BEGIN MAC-----"
      #define MAC_TRAILER           "-----END MAC-----"
      #define PAD_HEADER            "-----BEGIN PAD-----"
      #define PAD_TRAILER           "-----END PAD-----"

      typedef enum {
          ENCRYPT,
          DECRYPT,
          UNKNOWN
      } CommandType;

      typedef enum {
         SYMKEY = 0,
         MACKEY = 1,
         IV     = 2,
         MAC    = 3,
         PAD    = 4
      } HeaderType;


      /* Print a usage message and exit */
      static void Usage(const char *progName)
      {
          fprintf(stderr, "\nUsage:  %s -c <a|b> -d <dbdirpath> [-z <noisefilename>] "
                  "[-p <dbpwd> | -f <dbpwdfile>] -i <ipfilename> -o <opfilename>\n\n",
                  progName);
          fprintf(stderr, "%-20s  Specify 'a' for encrypt operation\n\n",
                   "-c <a|b>");
          fprintf(stderr, "%-20s  Specify 'b' for decrypt operation\n\n",
                   " ");
          fprintf(stderr, "%-20s  Specify db directory path\n\n",
                   "-d <dbdirpath>");
          fprintf(stderr, "%-20s  Specify db password [optional]\n\n",
                   "-p <dbpwd>");
          fprintf(stderr, "%-20s  Specify db password file [optional]\n\n",
                   "-f <dbpwdfile>");
          fprintf(stderr, "%-20s  Specify noise file name [optional]\n\n",
                   "-z <noisefilename>");
          fprintf(stderr, "%-21s Specify an input file name\n\n",
                   "-i <ipfilename>");
          fprintf(stderr, "%-21s Specify an output file name\n\n",
                   "-o <opfilename>");
          fprintf(stderr, "%-7s For encrypt, it takes <ipfilename> as an input file and produces\n",
                   "Note :");
          fprintf(stderr, "%-7s <ipfilename>.enc and <ipfilename>.header as intermediate output files.\n\n",
                   "");
          fprintf(stderr, "%-7s For decrypt, it takes <ipfilename>.enc and <ipfilename>.header\n",
                   "");
          fprintf(stderr, "%-7s as input files and produces <opfilename> as a final output file.\n\n",
                   "");
          exit(-1);
      }

      /* This Source Code Form is subject to the terms of the Mozilla Public
       * License, v. 2.0. If a copy of the MPL was not distributed with this
       * file, you can obtain one at https://mozilla.org/MPL/2.0/. */

      /* NSPR Headers */
      #include <prthread.h>
      #include <plgetopt.h>
      #include <prerror.h>
      #include <prinit.h>
      #include <prlog.h>
      #include <prtypes.h>
      #include <plstr.h>

      /*
       * Gather a CKA_ID
       */
      SECStatus
      GatherCKA_ID(PK11SymKey* key, SECItem* buf)
      {
          SECStatus rv = PK11_ReadRawAttribute(PK11_TypeSymKey, key, CKA_ID, buf);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "PK11_ReadRawAttribute returned (%d)\n", rv);
              PR_fprintf(PR_STDERR, "Could not read SymKey CKA_ID attribute\n");
              return rv;
          }
          return rv;
      }

      /*
       * Generate a Symmetric Key
       */
      PK11SymKey *
      GenerateSYMKey(PK11SlotInfo  *slot, CK_MECHANISM_TYPE mechanism,
                     int keySize, SECItem *keyID, secuPWData *pwdata)
      {
          SECStatus      rv;
          PK11SymKey    *key;

          if (PK11_NeedLogin(slot)) {
              rv = PK11_Authenticate(slot, PR_TRUE, pwdata);
              if (rv != SECSuccess) {
                  PR_fprintf(PR_STDERR, "Could not authenticate to token %s.\n",
                             PK11_GetTokenName(slot));
                  return NULL;
              }
          }

          /* Generate the symmetric key */
          key = PK11_TokenKeyGen(slot, mechanism,
                                 NULL, keySize, keyID, PR_TRUE, pwdata);

          if (!key) {
              PR_fprintf(PR_STDERR, "Symmetric Key Generation Failed \n");
          }

          return key;
      }

      /*
       * MacInit
       */
      SECStatus
      MacInit(PK11Context *ctx)
      {
          SECStatus rv = PK11_DigestBegin(ctx);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Compute MAC Failed : PK11_DigestBegin()\n");
          }
          return rv;
      }

      /*
       * MacUpdate
       */
      SECStatus
      MacUpdate(PK11Context *ctx,
                unsigned char *msg, unsigned int msgLen)
      {
          SECStatus rv = PK11_DigestOp(ctx, msg, msgLen);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Compute MAC Failed : DigestOp()\n");
          }
          return rv;
      }

      /*
       * Finalize MACing
       */
      SECStatus
      MacFinal(PK11Context *ctx,
               unsigned char *mac, unsigned int *macLen, unsigned int maxLen)
      {
          SECStatus rv = PK11_DigestFinal(ctx, mac, macLen, maxLen);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Compute MAC Failed : PK11_DigestFinal()\n");
          }
          return SECSuccess;
      }

      /*
       * Compute Mac
       */
      SECStatus
      ComputeMac(PK11Context *ctxmac,
                 unsigned char *ptext, unsigned int ptextLen,
                 unsigned char *mac, unsigned int *macLen,
                 unsigned int maxLen)
      {
          SECStatus rv = MacInit(ctxmac);
          if (rv != SECSuccess) return rv;
          rv = MacUpdate(ctxmac, ptext, ptextLen);
          if (rv != SECSuccess) return rv;
          rv = MacFinal(ctxmac, mac, macLen, maxLen);
          return rv;
      }

      /*
       * Write To Header File
       */
      SECStatus
      WriteToHeaderFile(const char *buf, unsigned int len, HeaderType type,
                        PRFileDesc *outFile)
      {
          SECStatus      rv;
          char           header[40];
          char           trailer[40];
          char          *outString = NULL;

          switch (type) {
          case SYMKEY:
              strcpy(header, ENCKEY_HEADER);
              strcpy(trailer, ENCKEY_TRAILER);
              break;
          case MACKEY:
              strcpy(header, MACKEY_HEADER);
              strcpy(trailer, MACKEY_TRAILER);
              break;
          case IV:
              strcpy(header, IV_HEADER);
              strcpy(trailer, IV_TRAILER);
              break;
          case MAC:
              strcpy(header, MAC_HEADER);
              strcpy(trailer, MAC_TRAILER);
              break;
          case PAD:
              strcpy(header, PAD_HEADER);
              strcpy(trailer, PAD_TRAILER);
              break;
          }

          PR_fprintf(outFile, "%s\n", header);
          PrintAsHex(outFile, buf, len);
          PR_fprintf(outFile, "%s\n\n", trailer);
          return SECSuccess;
      }

      /*
       * Initialize for encryption or decryption - common code
       */
      PK11Context *
      CryptInit(PK11SymKey *key,
                unsigned char *iv, unsigned int ivLen,
                CK_MECHANISM_TYPE type, CK_ATTRIBUTE_TYPE operation)
      {
          SECItem ivItem = { siBuffer, iv, ivLen };
          PK11Context *ctx = NULL;

          SECItem *secParam = PK11_ParamFromIV(CKM_AES_CBC, &ivItem);
          if (secParam == NULL) {
              PR_fprintf(PR_STDERR, "Crypt Failed : secParam NULL\n");
              return NULL;
          }
          ctx = PK11_CreateContextBySymKey(CKM_AES_CBC, operation, key, secParam);
          if (ctx == NULL) {
              PR_fprintf(PR_STDERR, "Crypt Failed : can't create a context\n");
              goto cleanup;

          }
      cleanup:
          if (secParam) {
              SECITEM_FreeItem(secParam, PR_TRUE);
          }
          return ctx;
      }

      /*
       * Common encryption and decryption code
       */
      SECStatus
      Crypt(PK11Context *ctx,
            unsigned char *out, unsigned int *outLen, unsigned int maxOut,
            unsigned char *in, unsigned int inLen)
      {
          SECStatus rv;

          rv = PK11_CipherOp(ctx, out, outLen, maxOut, in, inLen);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Crypt Failed : PK11_CipherOp returned %d\n", rv);
              goto cleanup;
          }

      cleanup:
          if (rv != SECSuccess) {
              return rv;
          }
          return SECSuccess;
      }

      /*
       * Decrypt
       */
      SECStatus
      Decrypt(PK11Context *ctx,
              unsigned char *out, unsigned int *outLen, unsigned int maxout,
              unsigned char *in, unsigned int inLen)
      {
          return Crypt(ctx, out, outLen, maxout, in, inLen);
      }

      /*
       * Encrypt
       */
      SECStatus
      Encrypt(PK11Context* ctx,
              unsigned char *out, unsigned int *outLen, unsigned int maxout,
              unsigned char *in, unsigned int inLen)
      {
          return Crypt(ctx, out, outLen, maxout, in, inLen);
      }

      /*
       * EncryptInit
       */
      PK11Context *
      EncryptInit(PK11SymKey *ek, unsigned char *iv, unsigned int ivLen,
                  CK_MECHANISM_TYPE type)
      {
          return CryptInit(ek, iv, ivLen, type, CKA_ENCRYPT);
      }

      /*
       * DecryptInit
       */
      PK11Context *
      DecryptInit(PK11SymKey *dk, unsigned char *iv, unsigned int ivLen,
                  CK_MECHANISM_TYPE type)
      {
          return CryptInit(dk, iv, ivLen, type, CKA_DECRYPT);
      }

      /*
       * Read cryptographic parameters from the header file
       */
      SECStatus
      ReadFromHeaderFile(const char *fileName, HeaderType type,
                         SECItem *item, PRBool isHexData)
      {
          SECStatus      rv;
          PRFileDesc*    file;
          SECItem        filedata;
          SECItem        outbuf;
          unsigned char *nonbody;
          unsigned char *body;
          char           header[40];
          char           trailer[40];

          outbuf.type = siBuffer;
          file = PR_Open(fileName, PR_RDONLY, 0);
          if (!file) {
              PR_fprintf(PR_STDERR, "Failed to open %s\n", fileName);
              return SECFailure;
          }
          switch (type) {
          case SYMKEY:
              strcpy(header, ENCKEY_HEADER);
              strcpy(trailer, ENCKEY_TRAILER);
              break;
          case MACKEY:
              strcpy(header, MACKEY_HEADER);
              strcpy(trailer, MACKEY_TRAILER);
              break;
          case IV:
              strcpy(header, IV_HEADER);
              strcpy(trailer, IV_TRAILER);
              break;
          case MAC:
              strcpy(header, MAC_HEADER);
              strcpy(trailer, MAC_TRAILER);
              break;
          case PAD:
              strcpy(header, PAD_HEADER);
              strcpy(trailer, PAD_TRAILER);
              break;
          }

          rv = FileToItem(&filedata, file);
          nonbody = (char *)filedata.data;
          if (!nonbody) {
              PR_fprintf(PR_STDERR, "unable to read data from input file\n");
              rv = SECFailure;
              goto cleanup;
          }

          /* check for headers and trailers and remove them */
          if ((body = strstr(nonbody, header)) != NULL) {
              char *trail = NULL;
              nonbody = body;
              body = PORT_Strchr(body, '\n');
              if (!body)
                  body = PORT_Strchr(nonbody, '\r'); /* maybe this is a MAC file */
              if (body)
                  trail = strstr(++body, trailer);
              if (trail != NULL) {
                  *trail = '\0';
              } else {
                  PR_fprintf(PR_STDERR,  "input has header but no trailer\n");
                  PORT_Free(filedata.data);
                  return SECFailure;
              }
          } else {
              body = nonbody;
          }

      cleanup:
          PR_Close(file);
          HexToBuf(body, item, isHexData);
          return SECSuccess;
      }

      /*
       * EncryptAndMac
       */
      SECStatus
      EncryptAndMac(PRFileDesc *inFile,
                    PRFileDesc *headerFile,
                    PRFileDesc *encFile,
                    PK11SymKey *ek,
                    PK11SymKey *mk,
                    unsigned char *iv, unsigned int ivLen,
                    PRBool ascii)
      {
          SECStatus      rv;
          unsigned char  ptext[BLOCKSIZE];
          unsigned int   ptextLen;
          unsigned char  mac[DIGESTSIZE];
          unsigned int   macLen;
          unsigned int   nwritten;
          unsigned char  encbuf[BLOCKSIZE];
          unsigned int   encbufLen;
          SECItem        noParams = { siBuffer, NULL, 0 };
          PK11Context   *ctxmac = NULL;
          PK11Context   *ctxenc = NULL;
          unsigned int   pad[1];
          SECItem        padItem;
          unsigned int   paddingLength;

          static unsigned int firstTime = 1;
          int j;

          ctxmac = PK11_CreateContextBySymKey(CKM_MD5_HMAC, CKA_SIGN, mk, &noParams);
          if (ctxmac == NULL) {
              PR_fprintf(PR_STDERR, "Can't create MAC context\n");
              rv = SECFailure;
              goto cleanup;
          }
          rv = MacInit(ctxmac);
          if (rv != SECSuccess) {
              goto cleanup;
          }

          ctxenc = EncryptInit(ek, iv, ivLen, CKM_AES_CBC);

          /* read a buffer of plaintext from input file */
          while ((ptextLen = PR_Read(inFile, ptext, sizeof(ptext))) > 0) {

              /* Encrypt using it using CBC, using previously created IV */
              if (ptextLen != BLOCKSIZE) {
                  paddingLength = BLOCKSIZE - ptextLen;
                  for ( j=0; j < paddingLength; j++) {
                      ptext[ptextLen+j] = (unsigned char)paddingLength;
                  }
                  ptextLen = BLOCKSIZE;
              }
              rv  = Encrypt(ctxenc,
                      encbuf, &encbufLen, sizeof(encbuf),
                      ptext, ptextLen);
              if (rv != SECSuccess) {
                  PR_fprintf(PR_STDERR, "Encrypt Failure\n");
                  goto cleanup;
              }

              /* save the last block of ciphertext as the next IV */
              iv = encbuf;
              ivLen = encbufLen;

              /* write the cipher text to intermediate file */
              nwritten = PR_Write(encFile, encbuf, encbufLen);
              /*PR_Assert(nwritten == encbufLen);*/

              rv = MacUpdate(ctxmac, ptext, ptextLen);
          }

          rv = MacFinal(ctxmac, mac, &macLen, DIGESTSIZE);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "MacFinal Failure\n");
              goto cleanup;
          }
          if (macLen == 0) {
              PR_fprintf(PR_STDERR, "Bad MAC length\n");
              rv = SECFailure;
              goto cleanup;
          }
          WriteToHeaderFile(mac, macLen, MAC, headerFile);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Write MAC Failure\n");
              goto cleanup;
          }

          pad[0] = paddingLength;
          padItem.type = siBuffer;
          padItem.data = (unsigned char *)pad;
          padItem.len  = sizeof(pad[0]);

          WriteToHeaderFile(padItem.data, padItem.len, PAD, headerFile);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Write PAD Failure\n");
              goto cleanup;
          }

          rv = SECSuccess;

      cleanup:
          if (ctxmac != NULL) {
              PK11_DestroyContext(ctxmac, PR_TRUE);
          }
          if (ctxenc != NULL) {
              PK11_DestroyContext(ctxenc, PR_TRUE);
          }

          return rv;
      }

      /*
       * Find the Key for the given mechanism
       */
      PK11SymKey*
      FindKey(PK11SlotInfo *slot,
              CK_MECHANISM_TYPE mechanism,
              SECItem *keyBuf, secuPWData *pwdata)
      {
          SECStatus      rv;
          PK11SymKey    *key;

          if (PK11_NeedLogin(slot)) {
              rv = PK11_Authenticate(slot, PR_TRUE, pwdata);
              if (rv != SECSuccess) {
                  PR_fprintf(PR_STDERR,
                             "Could not authenticate to token %s.\n",
                             PK11_GetTokenName(slot));
                  if (slot) {
                      PK11_FreeSlot(slot);
                  }
                  return NULL;
              }
          }

          key = PK11_FindFixedKey(slot, mechanism, keyBuf, 0);
          if (!key) {
              PR_fprintf(PR_STDERR,
                         "PK11_FindFixedKey failed (err %d)\n",
                         PR_GetError());
              PK11_FreeSlot(slot);
              return NULL;
          }
          return key;
      }

      /*
       * Decrypt and Verify MAC
       */
      SECStatus
      DecryptAndVerifyMac(
          const char* outFileName,
          char *encryptedFileName,
          SECItem *cItem, SECItem *macItem,
          PK11SymKey* ek, PK11SymKey* mk, SECItem *ivItem, SECItem *padItem)
      {
          SECStatus      rv;
          PRFileDesc*    inFile;
          PRFileDesc*    outFile;

          unsigned char  decbuf[64];
          unsigned int   decbufLen;

          unsigned char  ptext[BLOCKSIZE];
          unsigned int   ptextLen = 0;
          unsigned char  ctext[64];
          unsigned int   ctextLen;
          unsigned char  newmac[DIGESTSIZE];
          unsigned int   newmacLen                 = 0;
          unsigned int   newptextLen               = 0;
          unsigned int   count                     = 0;
          unsigned int   temp                      = 0;
          unsigned int   blockNumber               = 0;
          SECItem        noParams = { siBuffer, NULL, 0 };
          PK11Context   *ctxmac = NULL;
          PK11Context   *ctxenc = NULL;

          unsigned char iv[BLOCKSIZE];
          unsigned int ivLen = ivItem->len;
          unsigned int fileLength;
          unsigned int paddingLength;
          int j;

          memcpy(iv, ivItem->data, ivItem->len);
          paddingLength = (unsigned int)padItem->data[0];

          ctxmac = PK11_CreateContextBySymKey(CKM_MD5_HMAC, CKA_SIGN, mk, &noParams);
          if (ctxmac == NULL) {
              PR_fprintf(PR_STDERR, "Can't create MAC context\n");
              rv = SECFailure;
              goto cleanup;
          }

          /*  Open the input file.  */
          inFile = PR_Open(encryptedFileName, PR_RDONLY , 0);
          if (!inFile) {
              PR_fprintf(PR_STDERR,
                         "Unable to open \"%s\" for writing.\n",
                         encryptedFileName);
              return SECFailure;
          }
          /*  Open the output file.  */
          outFile = PR_Open(outFileName,
                            PR_CREATE_FILE | PR_TRUNCATE | PR_RDWR , 00660);
          if (!outFile) {
              PR_fprintf(PR_STDERR,
                         "Unable to open \"%s\" for writing.\n",
                         outFileName);
              return SECFailure;
          }

          rv = MacInit(ctxmac);
          if (rv != SECSuccess) goto cleanup;

          ctxenc = DecryptInit(ek, iv, ivLen, CKM_AES_CBC);
          fileLength = FileSize(encryptedFileName);

          while ((ctextLen = PR_Read(inFile, ctext, sizeof(ctext))) > 0) {

              count += ctextLen;

              /* decrypt cipher text buffer using CBC and IV */

              rv = Decrypt(ctxenc, decbuf, &decbufLen, sizeof(decbuf),
                           ctext, ctextLen);

              if (rv != SECSuccess) {
                  PR_fprintf(PR_STDERR, "Decrypt Failure\n");
                  goto cleanup;
              }

              if (decbufLen == 0) break;

              rv = MacUpdate(ctxmac, decbuf, decbufLen);
              if (rv != SECSuccess) { goto cleanup; }
              if (count == fileLength) {
                  decbufLen = decbufLen-paddingLength;
              }

              /* write the plain text to out file */
              temp = PR_Write(outFile, decbuf, decbufLen);
              if (temp != decbufLen) {
                  PR_fprintf(PR_STDERR, "write error\n");
                  rv = SECFailure;
                  break;
              }

              /* save last block of ciphertext */
              memcpy(iv, decbuf, decbufLen);
              ivLen = decbufLen;
              blockNumber++;
          }

          if (rv != SECSuccess) { goto cleanup; }

          rv = MacFinal(ctxmac, newmac, &newmacLen, sizeof(newmac));
          if (rv != SECSuccess) { goto cleanup; }

          if (PORT_Memcmp(macItem->data, newmac, newmacLen) == 0) {
              rv = SECSuccess;
          } else {
              PR_fprintf(PR_STDERR, "Check MAC : Failure\n");
              PR_fprintf(PR_STDERR, "Extracted : ");
              PrintAsHex(PR_STDERR, macItem->data, macItem->len);
              PR_fprintf(PR_STDERR, "Computed  : ");
              PrintAsHex(PR_STDERR, newmac, newmacLen);
              rv = SECFailure;
          }
      cleanup:
          if (ctxmac) {
              PK11_DestroyContext(ctxmac, PR_TRUE);
          }
          if (ctxenc) {
              PK11_DestroyContext(ctxenc, PR_TRUE);
          }
          if (outFile) {
              PR_Close(outFile);
          }

          return rv;
      }

      /*
       * Gets IV and CKAIDs From Header File
       */
      SECStatus
      GetIVandCKAIDSFromHeader(const char *cipherFileName,
                  SECItem *ivItem, SECItem *encKeyItem, SECItem *macKeyItem)
      {
          SECStatus      rv;

          /* open intermediate file, read in header, get IV and CKA_IDs of two keys
           * from it
           */
          rv = ReadFromHeaderFile(cipherFileName, IV, ivItem, PR_TRUE);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Could not retrieve IV from cipher file\n");
              goto cleanup;
          }

          rv = ReadFromHeaderFile(cipherFileName, SYMKEY, encKeyItem, PR_TRUE);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR,
              "Could not retrieve AES CKA_ID from cipher file\n");
              goto cleanup;
          }
          rv = ReadFromHeaderFile(cipherFileName, MACKEY, macKeyItem, PR_TRUE);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR,
                         "Could not retrieve MAC CKA_ID from cipher file\n");
              goto cleanup;
          }
      cleanup:
          return rv;
      }

      /*
       * Decrypt a File
       */
      SECStatus
      DecryptFile(PK11SlotInfo *slot,
                  const char   *dbdir,
                  const char   *outFileName,
                  const char   *headerFileName,
                  char         *encryptedFileName,
                  secuPWData   *pwdata,
                  PRBool       ascii)
      {
          /*
           * The DB is open read only and we have authenticated to it
           * open input file, read in header, get IV and CKA_IDs of two keys from it
           * find those keys in the DB token
           * Open output file
           * loop until EOF(input):
           *     read a buffer of ciphertext from input file
           *     save last block of ciphertext
           *     decrypt ciphertext buffer using CBC and IV
           *     compute and check MAC, then remove MAC from plaintext
           *     replace IV with saved last block of ciphertext
           *     write the plain text to output file
           * close files
           * report success
           */

          SECStatus           rv;
          SECItem             ivItem;
          SECItem             encKeyItem;
          SECItem             macKeyItem;
          SECItem             cipherItem;
          SECItem             macItem;
          SECItem             padItem;
          PK11SymKey         *encKey              = NULL;
          PK11SymKey         *macKey              = NULL;


          /* open intermediate file, read in header, get IV and CKA_IDs of two keys
           * from it
           */
          rv = GetIVandCKAIDSFromHeader(headerFileName,
                     &ivItem, &encKeyItem, &macKeyItem);
          if (rv != SECSuccess) {
              goto cleanup;
          }

          /* find those keys in the DB token */
          encKey = FindKey(slot, CKM_AES_CBC, &encKeyItem, pwdata);
          if (encKey == NULL) {
              PR_fprintf(PR_STDERR, "Can't find the encryption key\n");
              rv = SECFailure;
              goto cleanup;
          }
          /* CKM_MD5_HMAC or CKM_EXTRACT_KEY_FROM_KEY */
          macKey = FindKey(slot, CKM_MD5_HMAC, &macKeyItem, pwdata);
          if (macKey == NULL) {
              rv = SECFailure;
              goto cleanup;
          }

          /* Read in the Mac into item from the intermediate file */
          rv = ReadFromHeaderFile(headerFileName, MAC, &macItem, PR_TRUE);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR,
                         "Could not retrieve MAC from cipher file\n");
              goto cleanup;
          }
          if (macItem.data == NULL) {
              PR_fprintf(PR_STDERR, "MAC has NULL data\n");
              rv = SECFailure;
              goto cleanup;
          }
          if (macItem.len == 0) {
              PR_fprintf(PR_STDERR, "MAC has data has 0 length\n");
              /*rv = SECFailure;
              goto cleanup;*/
          }

          rv = ReadFromHeaderFile(headerFileName, PAD, &padItem, PR_TRUE);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR,
                         "Could not retrieve PAD detail from header file\n");
              goto cleanup;
          }

          if (rv == SECSuccess) {
              /* Decrypt and Remove Mac */
              rv = DecryptAndVerifyMac(outFileName, encryptedFileName,
                      &cipherItem, &macItem, encKey, macKey, &ivItem, &padItem);
              if (rv != SECSuccess) {
                  PR_fprintf(PR_STDERR, "Failed while decrypting and removing MAC\n");
              }
          }

      cleanup:
          if (slot) {
              PK11_FreeSlot(slot);
          }
          if (encKey) {
              PK11_FreeSymKey(encKey);
          }
          if (macKey) {
              PK11_FreeSymKey(macKey);
          }

          return rv;
      }

      /*
       * Encrypt a File
       */
      SECStatus
      EncryptFile(
          PK11SlotInfo *slot,
          const char   *dbdir,
          const char   *inFileName,
          const char   *headerFileName,
          const char   *encryptedFileName,
          const char   *noiseFileName,
          secuPWData   *pwdata,
          PRBool       ascii)
      {
          /*
           * The DB is open for read/write and we have authenticated to it.
           * generate a symmetric AES key as a token object.
           * generate a second key to use for MACing, also a token object.
           * get their CKA_IDs
           * generate a random value to use as IV for AES CBC
           * open an input file and an output file,
           * write a header to the output that identifies the two keys by
           *  their CKA_IDs, May include original file name and length.
           * loop until EOF(input)
           *    read a buffer of plaintext from input file
           *    MAC it, append the MAC to the plaintext
           *    encrypt it using CBC, using previously created IV
           *    store the last block of ciphertext as the new IV
           *    write the cipher text to intermediate file
           *    close files
           *    report success
           */
          SECStatus           rv;
          PRFileDesc         *inFile;
          PRFileDesc         *headerFile;
          PRFileDesc         *encFile;

          unsigned char      *encKeyId = (unsigned char *) "Encrypt Key";
          unsigned char      *macKeyId = (unsigned char *) "MAC Key";
          SECItem encKeyID = { siAsciiString, encKeyId, PL_strlen(encKeyId) };
          SECItem macKeyID = { siAsciiString, macKeyId, PL_strlen(macKeyId) };

          SECItem             encCKAID;
          SECItem             macCKAID;
          unsigned char       iv[BLOCKSIZE];
          SECItem             ivItem;
          PK11SymKey         *encKey = NULL;
          PK11SymKey         *macKey = NULL;
          SECItem             temp;
          unsigned char       c;

          /* generate a symmetric AES key as a token object. */
          encKey = GenerateSYMKey(slot, CKM_AES_KEY_GEN, 128/8, &encKeyID, pwdata);
          if (encKey == NULL) {
              PR_fprintf(PR_STDERR, "GenerateSYMKey for AES returned NULL.\n");
              rv = SECFailure;
              goto cleanup;
          }

          /* generate a second key to use for MACing, also a token object. */
          macKey = GenerateSYMKey(slot, CKM_GENERIC_SECRET_KEY_GEN, 160/8,
                                  &macKeyID, pwdata);
          if (macKey == NULL) {
              PR_fprintf(PR_STDERR, "GenerateSYMKey for MACing returned NULL.\n");
              rv = SECFailure;
              goto cleanup;
          }

          /* get the encrypt key CKA_ID */
          rv = GatherCKA_ID(encKey, &encCKAID);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Error while wrapping encrypt key\n");
              goto cleanup;
          }

          /* get the MAC key CKA_ID */
          rv = GatherCKA_ID(macKey, &macCKAID);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Can't get the MAC key CKA_ID.\n");
              goto cleanup;
          }

          if (noiseFileName) {
              rv = SeedFromNoiseFile(noiseFileName);
              if (rv != SECSuccess) {
                  PORT_SetError(PR_END_OF_FILE_ERROR);
                  return SECFailure;
              }
              rv = PK11_GenerateRandom(iv, BLOCKSIZE);
              if (rv != SECSuccess) {
                  goto cleanup;
              }

          } else {
              /* generate a random value to use as IV for AES CBC */
              GenerateRandom(iv, BLOCKSIZE);
          }

          headerFile = PR_Open(headerFileName,
                               PR_CREATE_FILE | PR_TRUNCATE | PR_RDWR, 00660);
          if (!headerFile) {
              PR_fprintf(PR_STDERR,
                         "Unable to open \"%s\" for writing.\n",
                         headerFileName);
              return SECFailure;
          }
          encFile = PR_Open(encryptedFileName,
                            PR_CREATE_FILE | PR_TRUNCATE | PR_RDWR, 00660);
          if (!encFile) {
              PR_fprintf(PR_STDERR,
                         "Unable to open \"%s\" for writing.\n",
                         encryptedFileName);
              return SECFailure;
          }
          /* write to a header file the IV and the CKA_IDs
           * identifying the two keys
           */
          ivItem.type = siBuffer;
          ivItem.data = iv;
          ivItem.len = BLOCKSIZE;

          rv = WriteToHeaderFile(iv, BLOCKSIZE, IV, headerFile);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Error writing IV to cipher file - %s\n",
                         headerFileName);
              goto cleanup;
          }

          rv = WriteToHeaderFile(encCKAID.data, encCKAID.len, SYMKEY, headerFile);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Error writing AES CKA_ID to cipher file - %s\n",
              encryptedFileName);
              goto cleanup;
          }
          rv = WriteToHeaderFile(macCKAID.data, macCKAID.len, MACKEY, headerFile);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Error writing MAC CKA_ID to cipher file - %s\n",
                         headerFileName);
              goto cleanup;
          }

          /*  Open the input file.  */
          inFile = PR_Open(inFileName, PR_RDONLY, 0);
          if (!inFile) {
              PR_fprintf(PR_STDERR, "Unable to open \"%s\" for reading.\n",
                         inFileName);
              return SECFailure;
          }

          /* Macing and Encryption */
          if (rv == SECSuccess) {
              rv = EncryptAndMac(inFile, headerFile, encFile,
                                 encKey, macKey, ivItem.data, ivItem.len, ascii);
              if (rv != SECSuccess) {
                  PR_fprintf(PR_STDERR, "Failed : MACing and Encryption\n");
                  goto cleanup;
              }
          }

      cleanup:
          if (inFile) {
              PR_Close(inFile);
          }
          if (headerFile) {
              PR_Close(headerFile);
          }
          if (encFile) {
              PR_Close(encFile);
          }
          if (slot) {
              PK11_FreeSlot(slot);
          }
          if (encKey) {
              PK11_FreeSymKey(encKey);
          }
          if (macKey) {
              PK11_FreeSymKey(macKey);
          }

          return rv;
      }

      /*
       * This example illustrates basic encryption/decryption and MACing.
       * Generates the encryption/mac keys and uses token for storing.
       * Encrypts the input file and appends MAC before storing in intermediate
       * header file.
       * Writes the CKA_IDs of the encryption keys into intermediate header file.
       * Reads the intermediate header file for CKA_IDs and encrypted
       * contents and decrypts into output file.
       */
      int main(int argc, char **argv)
      {
          SECStatus           rv;
          SECStatus           rvShutdown;
          PK11SlotInfo        *slot = NULL;
          PLOptState          *optstate;
          PLOptStatus         status;
          char                headerFileName[50];
          char                encryptedFileName[50];
          PRFileDesc         *inFile;
          PRFileDesc         *outFile;
          PRBool              ascii = PR_FALSE;
          CommandType         cmd = UNKNOWN;
          const char         *command             = NULL;
          const char         *dbdir               = NULL;
          const char         *inFileName          = NULL;
          const char         *outFileName         = NULL;
          const char         *noiseFileName       = NULL;
          secuPWData          pwdata              = { PW_NONE, 0 };

          char * progName = strrchr(argv[0], '/');
          progName = progName ? progName + 1 : argv[0];

          /* Parse command line arguments */
          optstate = PL_CreateOptState(argc, argv, "c:d:i:o:f:p:z:a");
          while ((status = PL_GetNextOpt(optstate)) == PL_OPT_OK) {
              switch (optstate->option) {
              case 'a':
                  ascii = PR_TRUE;
                  break;
              case 'c':
                  command = strdup(optstate->value);
                  break;
              case 'd':
                  dbdir = strdup(optstate->value);
                  break;
              case 'f':
                  pwdata.source = PW_FROMFILE;
                  pwdata.data = strdup(optstate->value);
                  break;
              case 'p':
                  pwdata.source = PW_PLAINTEXT;
                  pwdata.data = strdup(optstate->value);
                  break;
              case 'i':
                  inFileName = strdup(optstate->value);
                  break;
              case 'o':
                  outFileName = strdup(optstate->value);
                  break;
              case 'z':
                  noiseFileName = strdup(optstate->value);
                  break;
              default:
                  Usage(progName);
                  break;
              }
          }
          PL_DestroyOptState(optstate);

          if (!command || !dbdir || !inFileName || !outFileName)
              Usage(progName);
          if (PL_strlen(command)==0)
              Usage(progName);

          cmd = command[0] == 'a' ? ENCRYPT : command[0] == 'b' ? DECRYPT : UNKNOWN;

          /*  Open the input file.  */
          inFile = PR_Open(inFileName, PR_RDONLY, 0);
          if (!inFile) {
              PR_fprintf(PR_STDERR, "Unable to open \"%s\" for reading.\n",
                         inFileName);
              return SECFailure;
          }
          PR_Close(inFile);

          /* For intermediate header file, choose filename as inputfile name
             with extension ".header" */
          strcpy(headerFileName, inFileName);
          strcat(headerFileName, ".header");

          /* For intermediate encrypted file, choose filename as inputfile name
             with extension ".enc" */
          strcpy(encryptedFileName, inFileName);
          strcat(encryptedFileName, ".enc");

          PR_Init(PR_USER_THREAD, PR_PRIORITY_NORMAL, 0);

          switch (cmd) {
          case ENCRYPT:
              /* If the intermediate header file already exists, delete it */
              if (PR_Access(headerFileName, PR_ACCESS_EXISTS) == PR_SUCCESS) {
                  PR_Delete(headerFileName);
              }
              /* If the intermediate encrypted already exists, delete it */
              if (PR_Access(encryptedFileName, PR_ACCESS_EXISTS) == PR_SUCCESS) {
                  PR_Delete(encryptedFileName);
              }

              /* Open DB for read/write and authenticate to it. */
              rv = NSS_InitReadWrite(dbdir);
              if (rv != SECSuccess) {
                  PR_fprintf(PR_STDERR, "NSS_InitReadWrite Failed\n");
                  goto cleanup;
              }

              PK11_SetPasswordFunc(GetModulePassword);
              slot = PK11_GetInternalKeySlot();
              if (PK11_NeedLogin(slot)) {
                  rv = PK11_Authenticate(slot, PR_TRUE, &pwdata);
                  if (rv != SECSuccess) {
                      PR_fprintf(PR_STDERR, "Could not authenticate to token %s.\n",
                                 PK11_GetTokenName(slot));
                      goto cleanup;
                  }
              }
              rv = EncryptFile(slot, dbdir,
                                inFileName, headerFileName, encryptedFileName,
                                noiseFileName, &pwdata, ascii);
              if (rv != SECSuccess) {
                  PR_fprintf(PR_STDERR, "EncryptFile : Failed\n");
                  return SECFailure;
              }
              break;
          case DECRYPT:
              /* Open DB read only, authenticate to it */
              PK11_SetPasswordFunc(GetModulePassword);

              rv = NSS_Init(dbdir);
              if (rv != SECSuccess) {
                  PR_fprintf(PR_STDERR, "NSS_Init Failed\n");
                  return SECFailure;
              }

              slot = PK11_GetInternalKeySlot();
              if (PK11_NeedLogin(slot)) {
                  rv = PK11_Authenticate(slot, PR_TRUE, &pwdata);
                  if (rv != SECSuccess) {
                      PR_fprintf(PR_STDERR, "Could not authenticate to token %s.\n",
                                 PK11_GetTokenName(slot));
                      goto cleanup;
                  }
              }

              rv = DecryptFile(slot, dbdir,
                               outFileName, headerFileName,
                               encryptedFileName, &pwdata, ascii);
              if (rv != SECSuccess) {
                  PR_fprintf(PR_STDERR, "DecryptFile : Failed\n");
                  return SECFailure;
              }
              break;
          }

      cleanup:
          rvShutdown = NSS_Shutdown();
          if (rvShutdown != SECSuccess) {
              PR_fprintf(PR_STDERR, "Failed : NSS_Shutdown()\n");
              rv = SECFailure;
          }

          PR_Cleanup();

          return rv;
      }
      </plstr.h></prtypes.h></prlog.h></prinit.h></prerror.h></plgetopt.h></prthread.h></opfilename></ipfilename></ipfilename></ipfilename></ipfilename></ipfilename></opfilename></ipfilename></noisefilename></dbpwdfile></dbpwd></dbdirpath></a|b></opfilename></ipfilename></dbpwdfile></dbpwd></noisefilename></dbdirpath></a|b></pk11priv.h></keyhi.h></plstr.h></prtypes.h></prlog.h></prinit.h></prerror.h></plgetopt.h></prthread.h>