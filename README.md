svn_client_js
=============

A javascript lib use as a SVN client on web.

-------------


The lib supports follow SVN operations:

* svn add 
* svn rm (del, remove, delete)
* svn mkdir
* svn ps (propset, pset)
* svn pd (propdel, pdel)
* svn up (update)


*API*

<table>
  <tr>
    <td>name</td>
    <td>param</td>
    <td>type</td>
    <td>explain</td>
  </tr>
  <tr>
    <td>add</td>
    <td>
      <td>
        usname
      </td>
      <td>
        passwd
      </td>
      <td>
        basepath
      </td>
    </td>
  </tr>
</table>

Example:

1.  Generate an instance:
    > var mysvn =  new SVN(usname, passwd, basepath);
       * usname: your SVN username
       * passwd: your SVN password

2.  Then do what you can & what you want, like:
    > mysvn.mkdir('my_dir');
    > mysvn.add('test.txt', 'I am the content');
    > mysvn.propset('test.js', { 'mime-type': 'text/javscript' });

3.  The most important step:
    > mysvn.commit('Create a folder:my_dir and add a js file:test.js');
    If you do everything without this step,
    The request won't be sent.

Future will continue to support more operation command,
like move, copy, revert, lock, unlock.
