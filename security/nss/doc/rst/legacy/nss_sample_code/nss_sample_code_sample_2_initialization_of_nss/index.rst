.. _mozilla_projects_nss_nss_sample_code_nss_sample_code_sample_2_initialization_of_nss:

NSS Sample Code Sample_2_Initialization of NSS
==============================================

.. _nss_sample_code_2_initializing_nss:

`NSS Sample Code 2: Initializing NSS <#nss_sample_code_2_initializing_nss>`__
-----------------------------------------------------------------------------

.. container::

   This example program demonstrates how to initialize the NSS Database.  This program illustrates
   password handling.

.. _sample_code_1:

`Sample Code 1 <#sample_code_1>`__
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. container::

   .. code:: brush:

      /* NSPR Headers */
      #include <prthread.h>
      #include <plgetopt.h>
      #include <prprf.h>

      /* NSS headers */
      #include <nss.h>
      #include <pk11func.h>

      #include "util.h"

      /* Print a usage message and exit */
      static void Usage(const char *progName)
      {
          fprintf(stderr, "\nUsage:  %s -d <dbdirpath> [-p <plainpasswc>]"
                          " [-f <passwdffile>]\n\n",
                          progName);
          fprintf(stderr, "%-15s Specify a DB directory path\n\n",
                   "-d <dbdirpath>");
          fprintf(stderr, "%-15s Specify a plaintext password\n\n",
                   "-p <plainpasswc>");
          fprintf(stderr, "%-15s Specify a password file\n\n",
                   "-f <plainpasswc>");
          exit(-1);
      }

      /* Initialize the slot password */
      char *InitSlotPassword(PK11SlotInfo *slot, PRBool retry, void *arg)
      {
         FILE       *input;
         FILE       *output;
         char       *p0            = NULL;
         char       *p1            = NULL;
         secuPWData *pwdata        = (secuPWData *) arg;

         if (pwdata->source == PW_FROMFILE) {
             return FilePasswd(slot, retry, pwdata->data);
         }
         if (pwdata->source == PW_PLAINTEXT) {
             return PL_strdup(pwdata->data);
         }

         /* open terminal */
         input = fopen("/dev/tty", "r");
         if (input == NULL) {
             PR_fprintf(PR_STDERR, "Error opening input terminal for read\n");
             return NULL;
         }

         /* we have no password, so initialize database with one */
         PR_fprintf(PR_STDERR,
             "Enter a password which will be used to encrypt your keys.\n"
             "The password should be at least 8 characters long,\n"
             "and should contain at least one non-alphabetic character.\n\n");

         output = fopen("/dev/tty", "w");
         if (output == NULL) {
             PR_fprintf(PR_STDERR, "Error opening output terminal for write\n");
             return NULL;
         }

         for (;;) {
             if (p0)
                 PORT_Free(p0);
             p0 = GetPassword(input, output, "Enter new password: ",
                                                      CheckPassword);
             if (p1)
                 PORT_Free(p1);
             p1 = GetPassword(input, output, "Re-enter password: ",
                                                      CheckPassword);
             if (p0 && p1 && !PORT_Strcmp(p0, p1)) {
                 break;
             }
             PR_fprintf(PR_STDERR, "Passwords do not match. Try again.\n");
         }

         /* clear out the duplicate password string */
         if (p1) {
             PORT_Memset(p1, 0, PORT_Strlen(p1));
             PORT_Free(p1);
         }
         fclose(input);
         fclose(output);

         return p0;
      }

      /* Change the password */
      SECStatus ChangePW(PK11SlotInfo *slot, char *oldPass, char *newPass,
                         char *oldPwFile, char *newPwFile)
      {
          SECStatus rv;
          secuPWData pwdata;
          secuPWData newpwdata;
          char      *oldpw = NULL;
          char      *newpw = NULL;

          if (oldPass) {
              pwdata.source = PW_PLAINTEXT;
              pwdata.data = oldPass;
          } else if (oldPwFile) {
              pwdata.source = PW_FROMFILE;
              pwdata.data = oldPwFile;
          } else {
              pwdata.source = PW_NONE;
              pwdata.data = NULL;
          }

          if (newPass) {
              newpwdata.source = PW_PLAINTEXT;
              newpwdata.data = newPass;
          } else if (newPwFile) {
              newpwdata.source = PW_FROMFILE;
              newpwdata.data = NULL;
          } else {
              newpwdata.source = PW_NONE;
              newpwdata.data = NULL;
          }

          if (PK11_NeedUserInit(slot)) {
              newpw = InitSlotPassword(slot, PR_FALSE, &pwdata);
              rv = PK11_InitPin(slot, (char*)NULL, newpw);
          }
          else {
              for (;;) {
                  oldpw = GetModulePassword(slot, PR_FALSE, &pwdata);

                  if (PK11_CheckUserPassword(slot, oldpw) != SECSuccess) {
                      if (pwdata.source == PW_NONE) {
                          PR_fprintf(PR_STDERR, "Invalid password.  Try again.\n");
                      } else {
                          PR_fprintf(PR_STDERR, "Invalid password.\n");
                          PORT_Memset(oldpw, 0, PL_strlen(oldpw));
                          PORT_Free(oldpw);
                          return SECFailure;
                      }
                  } else {
                      break;
                  }
                  PORT_Free(oldpw);
              }
              newpw = InitSlotPassword(slot, PR_FALSE, &newpwdata);

              if (PK11_ChangePW(slot, oldpw, newpw) != SECSuccess) {
                  PR_fprintf(PR_STDERR, "Failed to change password.\n");
                  return SECFailure;
              }
              PORT_Memset(oldpw, 0, PL_strlen(oldpw));
              PORT_Free(oldpw);
              PR_fprintf(PR_STDOUT, "Password changed successfully.\n");
          }
          PORT_Memset(newpw, 0, PL_strlen(newpw));
          PORT_Free(newpw);
          return SECSuccess;
      }

      /*
       * This example illustrates initialization of the NSS database.
       * It creates an nss configuration directory with empty databases
       * and initializes the databases. It also illustrates techniques for
       * password handling.
       */
      int main(int argc, char **argv)
      {
          PLOptState     *optstate;
          PLOptStatus    status;
          SECStatus      rv;
          SECStatus      rvShutdown;
          char           *slotname    = "internal";
          PK11SlotInfo   *slot        = NULL;
          char           *dbdir       = NULL;
          char           *plainPass   = NULL;
          char           *pwFile      = NULL;

          char * progName = strrchr(argv[0], '/');
          progName = progName ? progName + 1 : argv[0];

          /* Parse command line arguments */
          optstate = PL_CreateOptState(argc, argv, "d:p:q:f:g:");
          while ((status = PL_GetNextOpt(optstate)) == PL_OPT_OK) {
              switch (optstate->option) {
              case 'd':
                   dbdir = strdup(optstate->value);
                   break;
              case 'p':
                   plainPass = strdup(optstate->value);
                   break;
              case 'f':
                   pwFile = strdup(optstate->value);
                   break;
              default:
                   Usage(progName);
                   break;
              }
          }
          PL_DestroyOptState(optstate);

          if (!dbdir)
              Usage(progName);

          PR_Init(PR_USER_THREAD, PR_PRIORITY_NORMAL, 0);

          /* Create the database */
          rv = NSS_InitReadWrite(dbdir);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "NSS_Initialize Failed");
              PR_Cleanup();
              exit(rv);
          }

          if (PL_strcmp(slotname, "internal") == 0)
              slot = PK11_GetInternalKeySlot();

          /*  If creating new database, initialize the password.  */
          rv = ChangePW(slot, plainPass, 0, pwFile, 0);
          if (rv != SECSuccess) {
              PR_fprintf(PR_STDERR, "Failed to change password\n");
          }

          if (slot) {
              PK11_FreeSlot(slot);
          }
          rvShutdown = NSS_Shutdown();
          if (rvShutdown != SECSuccess) {
              PR_fprintf(PR_STDERR, "Failed : NSS_Shutdown()\n");
              rv = SECFailure;
          }

          PR_Cleanup();

          return rv;
      }
      </plainpasswc></plainpasswc></dbdirpath></passwdffile></plainpasswc></dbdirpath></pk11func.h></nss.h></prprf.h></plgetopt.h></prthread.h>