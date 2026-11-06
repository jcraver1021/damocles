# Scorecards

One CSV per edition, referenced by `file:` in `config/rubric.yaml`. One row per member per congress:

`chamber,state,district,last,first,party,congress,score[,note,page]`

- `district`: House only (`0` = at-large). Members are matched by seat and last name; `first` breaks
  ties.
- `score`: 0–100 as published.

Files:

- `hrc-119.csv`: from `npm run scorecards:hrc`.
- `lcv.csv` (missing): scorecard.lcv.org blocks automated downloads; export by hand to enable it.
