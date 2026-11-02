source /opt/mopidy-dev/venv/bin/activate

echo "Updating eboback..."
cd /opt/mopidy-dev/mopidy_eboback || exit
OUTPUT=$(git pull --recurse-submodules 2>&1)
echo "$OUTPUT"
if [[ ! "$OUTPUT" == *"Already up to date."* ]]; then
    pip install .
fi

echo "Updating eboplayer..."
cd /opt/mopidy-dev/mopidy-eboplayer || exit
OUTPUT=$(git pull --recurse-submodules 2>&1)
echo "$OUTPUT"
if [[ ! "$OUTPUT" == *"Already up to date."* ]]; then
    pip install .
fi
echo "Restarting mopidy-dev service..."
sudo systemctl restart mopidy-dev
echo "Done"
