#!/bin/bash

# ccaf.sh
# This script provides a simple interface for controlling the server side of CCAF.

INFOLOG=info.log
ERRORLOG=error.log


usage () {
    echo "usage: \`./ccaf.sh COMMAND\` where COMMAND is one of the following:"
    echo "    start     Run the server"
    echo "    stop      Stop the server if it is running"
    echo "    restart   Restart the server if it is running, or start it if not"
    echo
    #echo "    backup DESTINATION    Copy all data to DESTINATION"
    #echo "    restore SOURCE        Restore server data from SOURCE"
    #echo "    destroy               Delete all server data"
    #echo 
    #echo "    update    Update CCAF to the latest version on the master branch"
    echo "    usage     Show this message (help)"
}


runserver () {
    npm run start 1>$INFOLOG 2>$ERRORLOG
    if [ $? -eq 1 ]; then
        echo "Server exited with errors. Check $ERRORLOG and $INFOLOG for details."
    else
        echo "Server exited cleanly."
    fi
}


start () {
    echo "Starting server..."
    runserver &
    echo "Server started (PID $!)"
}


stop () { 
    # Get PID of running server
    server_pid=$(pidof npm)
    if [ -z $server_pid ]; then
        echo "Server isn't running."
    else
        echo "Stopping server..."
        kill $server_pid

        # If npm won't die, wait a while
        counter=0
        while [[ ( ! -z $(pidof npm) ) && ( $counter -lt 10 ) ]]; do
            sleep 1
            ((counter++))
        done

        if [ $counter -eq 10 ]; then
            echo "Failed to stop server."
        else
            echo "Stopped."
        fi
    fi
}


restart () {
    stop
    start
}


#update () {
#    echo "Updating..."
#    git branch master
#    git pull -u origin master
#    echo "Done."
#}


# Run the given function, or print the help message
if [ "$(type -t $1)" = "function" ] ; then
    $1
else
    usage
fi

