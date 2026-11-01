# StatLab MERN presentation walkthrough

1. Double-click **START DEMO.cmd**. Open **http://127.0.0.1:4307** and select **Open demo workspace**. The dashboard shows five prepared datasets, one saved analysis and 50 observations.
2. Explain the stack: React renders the interface, Express/Node.js implements the REST API and statistics, Mongoose maps documents, and the separate local MongoDB instance stores the data inside this folder.
3. Open **Experiment 01**. Show the editable cells and its dataset revision. Select **Save changes & analyze**, then **Calculate statistics**.
4. Check the reference results below. Change the chart between histogram, box plot and cumulative frequency; use the download icon to export a PNG.
5. Save the analysis as **Presentation reference**. Show **Experimental Error = 2.5 %** in Custom parameters. Add a parameter with a value, unit and explanation if desired. Download the CSV or PDF report.
6. Edit the dataset and change 50 to 100, save, and calculate again. Reopen **Presentation reference** from Saved analyses: it is now marked **Historical**, its mean remains 30 and its snapshot still contains the original observations. Current data has mean 40. Manual parameters remain saved.
7. Open **Study hours & exam scores** for analysis. Choose **Exam score** as Y, calculate, and select **Scatter & regression**. Explain Pearson correlation, Spearman correlation, slope, intercept and R².
8. Open **Compare datasets**, select two or more datasets and compare their location and spread side by side.
9. Open **Settings** to show the local database name `statlab_4307`, host `127.0.0.1` and port `27027`. In MongoDB Compass, connect to `mongodb://127.0.0.1:27027/statlab_4307` to inspect the collections.
10. Sign out and sign back in to show persisted work. Stop with **Ctrl+C**, restart, and verify the saved datasets and reports remain available.

## Reference numerical results

For `10, 20, 30, 40, 50`:

| Statistic | Expected |
| --- | ---: |
| Count | 5 |
| Sum | 150 |
| Mean | 30 |
| Median | 30 |
| Q1 / Q3 | 20 / 40 |
| Population variance | 200 |
| Sample variance | 250 |
| Population standard deviation | 14.1421 |
| Sample standard deviation | 15.8114 |
| Standard error | 7.0711 |
| Mode | Undefined: every value occurs once |

## Other prepared data

- **Manufacturing measurements:** Mostly 9.8–10.2 mm, with 12.5 mm as an outlier.
- **Frequency example:** `[10,2], [20,5], [30,3]` expands to 10 exact observations with mean 21.
- **Grouped class intervals:** Interval midpoints approximate the underlying observations; the interface labels the results as estimates.

The walkthrough changes your demonstration workspace when you save edits. Restarting preserves those changes. You can create a fresh dataset with the sample-data button to repeat the reference calculation without editing existing work.
